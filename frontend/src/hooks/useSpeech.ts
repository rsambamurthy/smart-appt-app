import { useCallback, useEffect, useRef, useState } from 'react';
import { IS_NATIVE } from './usePlatform';

/**
 * Speaking to Phoebe, and Phoebe speaking back.
 *
 * WEB ONLY, DELIBERATELY. Dictation here uses the Web Speech API, which Android
 * WebView has never implemented — the Chromium issue asking for it has been open
 * for years. So inside the Capacitor app this reports unsupported and the
 * microphone does not appear, rather than appearing and failing on a tap.
 *
 * The mobile path needs @capacitor-community/speech-recognition, which is the
 * mirror image: Android and iOS supported, web not. Both live behind the same
 * hook signature below, so adding it later is a change in this file and nowhere
 * else.
 *
 * Speaking back is different — SpeechSynthesis works in the WebView too, so that
 * half is enabled everywhere.
 */

// ── Minimal typings ─────────────────────────────────────────────────────────
// Hand-written rather than pulling in @types/dom-speech-recognition: this is the
// entire surface used, the API is prefixed and unstable, and one more dependency
// to keep current is not worth avoiding fifteen lines.

interface SpeechAlternative { transcript: string; confidence: number }
interface SpeechResult { isFinal: boolean; 0: SpeechAlternative; length: number }
interface SpeechResultList { length: number; [i: number]: SpeechResult }
interface SpeechEvent  { resultIndex: number; results: SpeechResultList }
interface SpeechErrEvent { error: string }

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror:  ((e: SpeechErrEvent) => void) | null;
  onend:    (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (IS_NATIVE) return null;          // see the note at the top of this file
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Indian English. The difference between en-US and en-IN on "two thousand nine
 * hundred and seventy five rupees" is not subtle, and every user of this app is
 * in India.
 */
const LANG = 'en-IN';

/**
 * How long the microphone stays open with nobody saying anything.
 *
 * It normally closes as soon as a phrase is finished. This covers the case
 * where the button was tapped and nothing was said — a microphone left open
 * because someone was interrupted is exactly the always-listening behaviour
 * this design avoids.
 */
const IDLE_CLOSE_MS = 20_000;

export interface SpeechInput {
  supported:  boolean;
  /** The session is open — the microphone is live, or about to be. */
  active:     boolean;
  /** The recogniser is running right now. False while paused for playback. */
  listening:  boolean;
  /** What has been heard so far, including the unconfirmed tail. */
  transcript: string;
  error:      string;
  start:      () => void;
  stop:       () => void;
}

/**
 * Dictation. One question per tap.
 *
 * `onFinal` fires when the speaker pauses and the recogniser settles on a
 * phrase. The microphone then CLOSES. The caller auto-sends from there, so the
 * flow is: tap, speak, stop talking, and the question goes on its own.
 *
 * WHY NOT HANDS-FREE, AND WHY NOT A WAKE WORD.
 *
 * A held-open session was built and removed. Phoebe's spoken answer came back
 * in through the microphone and was asked as the next question. Pause signals
 * and settling delays narrowed the window but could not close it: the pause is
 * a software event, the sound is in the room, and the Web Speech API gives no
 * access to the echo-cancellation constraints that normal media capture has.
 *
 * "Hey Phoebe" is worse again — continuous recognition streams the room to
 * Google for as long as the app is open and keeps the microphone indicator lit,
 * and an on-device wake-word engine with a custom phrase costs more per year
 * than the rest of this product's hosting.
 *
 * `paused` is kept as a belt-and-braces guard for the window between a final
 * phrase and the microphone actually closing.
 */
export function useSpeechInput(
  onFinal?: (text: string) => void,
  paused = false,
): SpeechInput {
  const [active, setActive]         = useState(false);
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError]           = useState('');

  const recRef      = useRef<SpeechRecognitionLike | null>(null);
  const finalRef    = useRef('');
  const idleRef     = useRef<number | null>(null);
  /**
   * Set when a recogniser is torn down for a reason other than the speaker
   * finishing — a pause, or the session closing. `onend` fires either way, and
   * without this it would deliver a half-heard phrase as a finished question.
   */
  const discardRef  = useRef(false);
  // Held in refs so the restart effect does not need to re-run whenever the
  // parent re-renders with a new callback identity — which, in a loop that
  // restarts a microphone, would mean tearing it down and back up constantly.
  const cbRef       = useRef(onFinal);
  const activeRef   = useRef(false);
  useEffect(() => { cbRef.current = onFinal; }, [onFinal]);
  useEffect(() => { activeRef.current = active; }, [active]);

  const supported = recognitionCtor() !== null;

  const clearIdle = useCallback(() => {
    if (idleRef.current) window.clearTimeout(idleRef.current);
    idleRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearIdle();
    activeRef.current = false;
    discardRef.current = true;
    setActive(false);
    setListening(false);
    setTranscript('');
    recRef.current?.abort();
    recRef.current = null;
  }, [clearIdle]);

  /**
   * Cut the microphone the moment `paused` goes true.
   *
   * THE DEFECT THIS FIXES. The listening effect below returns early when a
   * recogniser is already running, so a pause arriving mid-phrase changed
   * nothing — the microphone stayed open right through Phoebe's spoken answer
   * and transcribed it as the next question. The pause only bit at the next
   * natural restart, by which point the damage was done.
   *
   * Aborting here ends it immediately. `onend` fires, `listening` clears, and
   * the effect declines to restart while paused. When the pause lifts, the
   * loop picks up again on its own.
   */
  useEffect(() => {
    if (!paused) return;
    if (!recRef.current) return;
    discardRef.current = true;
    finalRef.current = '';
    recRef.current.abort();
    recRef.current = null;
    setTranscript('');
    setListening(false);
  }, [paused]);

  /**
   * A guard band around the pause, in both directions.
   *
   * Aborting on pause is not enough on its own, because the pause signal and
   * the sound do not line up at either edge:
   *
   *   LEADING — the answer arrives, `isLoading` clears, and the speech
   *   synthesiser has not started yet, so `speaking` is briefly false. The
   *   microphone reopens into that gap and catches her first few words.
   *
   *   TRAILING — `onend` fires when the synthesiser finishes writing audio, not
   *   when the room goes quiet. Reopening the instant it fires catches the tail
   *   through the speakers.
   *
   * Either one restarts the loop the user hit. A short settling period after
   * the pause lifts closes both. Six hundred milliseconds is long enough to
   * cover the overlap and short enough that nobody notices it before speaking.
   */
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (paused) { setSettling(true); return; }
    const t = window.setTimeout(() => setSettling(false), 600);
    return () => window.clearTimeout(t);
  }, [paused]);

  const start = useCallback(() => {
    if (!recognitionCtor()) {
      setError('Voice input is not available in this browser.');
      return;
    }
    setError('');
    setTranscript('');
    setActive(true);
  }, []);

  /**
   * The listening loop.
   *
   * Declarative on purpose: whenever the session should be running and is not,
   * this starts a recogniser. `onend` simply clears `listening`, and the effect
   * brings it back. Chrome ends recognition after every pause, so something has
   * to restart it — doing that inside `onend` instead produces nested restarts
   * that are impossible to stop cleanly.
   */
  useEffect(() => {
    if (!active || paused || settling || listening) return;
    const Ctor = recognitionCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang            = LANG;
    rec.interimResults  = true;
    // Still false. True keeps one recogniser open across pauses, but Chrome
    // then batches results in ways that delay the final transcript — and the
    // restart loop already gives continuity.
    rec.continuous      = false;
    rec.maxAlternatives = 1;

    finalRef.current = '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else           interim += r[0].transcript;
      }
      setTranscript((finalRef.current + interim).trimStart());

      // Any speech at all resets the idle timer. The session closes for
      // silence, not for taking a while to finish a sentence.
      clearIdle();
      idleRef.current = window.setTimeout(() => {
        if (activeRef.current) stop();
      }, IDLE_CLOSE_MS);
    };

    rec.onerror = (e) => {
      // 'no-speech' and 'aborted' are ordinary in a restart loop — they fire
      // every time a pause ends a recogniser. Surfacing them would keep an
      // error banner permanently on screen.
      if (e.error === 'no-speech' || e.error === 'aborted') { setListening(false); return; }
      if (e.error === 'not-allowed') {
        setError('Microphone access was blocked. Allow it in your browser settings to use voice.');
        stop();
        return;
      }
      setError('Voice input stopped working. Please type instead.');
      stop();
    };

    rec.onend = () => {
      setListening(false);
      const said = finalRef.current.trim();
      finalRef.current = '';

      // Torn down deliberately — a pause or a stop. Whatever was captured is
      // half a sentence at best, and sending it would mean Phoebe answering a
      // fragment nobody finished saying.
      if (discardRef.current) {
        discardRef.current = false;
        setTranscript('');
        return;
      }

      // ONE QUESTION PER TAP. The microphone closes here rather than
      // restarting.
      //
      // A held-open session was tried and abandoned. Phoebe's spoken answer
      // came back through the microphone, was transcribed, and was asked as the
      // next question — a loop. It can be fought with pause signals and timing
      // guards, and those helped, but they are a race: the pause is a software
      // event and the sound is in the room, and on a phone speaker the room
      // wins often enough to matter.
      //
      // Closing the microphone before she speaks removes the race instead of
      // narrowing it. The cost is a tap per question. That is the right trade
      // for a feature that otherwise talks to itself.
      clearIdle();
      activeRef.current = false;
      setActive(false);

      if (said) {
        setTranscript('');
        cbRef.current?.(said);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // Thrown when a recogniser is already running. The effect will settle.
      setListening(false);
    }
  }, [active, paused, settling, listening, stop, clearIdle]);

  // Close the session if nothing is ever said after opening it.
  useEffect(() => {
    if (!active) return;
    clearIdle();
    idleRef.current = window.setTimeout(() => {
      if (activeRef.current) stop();
    }, IDLE_CLOSE_MS);
    return clearIdle;
    // Only on open — onresult re-arms it thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // A recogniser left running after the panel closes keeps the browser's
  // microphone indicator lit, which reads as the app listening in secret.
  useEffect(() => () => {
    if (idleRef.current) window.clearTimeout(idleRef.current);
    discardRef.current = true;
    recRef.current?.abort();
  }, []);

  return { supported, active, listening, transcript, error, start, stop };
}

// ── Speaking back ───────────────────────────────────────────────────────────

const VOICE_PREF_KEY = 'smartappt.phoebe.speak';

function readPref(): boolean {
  try { return window.localStorage.getItem(VOICE_PREF_KEY) === '1'; }
  catch { return false; }          // private mode, or storage disabled
}

export interface SpeechOutput {
  supported: boolean;
  enabled:   boolean;
  speaking:  boolean;
  toggle:    () => void;
  /**
   * `force` speaks even when the toggle is off.
   *
   * Used for one case only: the question was asked out loud. Someone talking to
   * Phoebe is not looking at the screen, and answering them silently is a dead
   * end. It does not change the saved preference — this turn is spoken, the
   * toggle still governs typed questions.
   */
  speak:     (text: string, force?: boolean) => void;
  cancel:    () => void;
}

/**
 * Reading answers aloud.
 *
 * Off by default and remembered. A chat panel that starts talking on a page
 * someone opened in an office is a good way to have the feature switched off
 * permanently in the first ten seconds.
 */
export function useSpeechOutput(): SpeechOutput {
  const hasApi = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // The API existing is not the same as it working. Android WebView exposes
  // speechSynthesis and frequently ships no voices at all, so speak() succeeds
  // and nothing is heard — a toggle that does nothing, which is worse than no
  // toggle. Voices also load asynchronously and are commonly empty on the first
  // call, hence the event as well as the immediate check.
  const [hasVoices, setHasVoices] = useState(false);
  useEffect(() => {
    if (!hasApi) return;
    const check = () => setHasVoices(window.speechSynthesis.getVoices().length > 0);
    check();
    window.speechSynthesis.addEventListener?.('voiceschanged', check);
    // Some WebViews never fire the event but do populate the list shortly after.
    const t = window.setTimeout(check, 600);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', check);
      window.clearTimeout(t);
    };
  }, [hasApi]);

  const supported = hasApi && hasVoices;

  const [enabled, setEnabled]   = useState(readPref);
  const [speaking, setSpeaking] = useState(false);

  // Stopping keys off hasApi, not `supported`. `supported` flips false to true
  // when voices finish loading, and hanging cleanup effects off a value that
  // changes mid-session cancels speech that is happily in progress.
  const cancel = useCallback(() => {
    if (!hasApi) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [hasApi]);

  const speak = useCallback((text: string, force = false) => {
    if (!supported || (!enabled && !force)) return;
    const clean = text.trim();
    if (!clean) return;

    // Anything already queued is dropped. Answers arriving on top of each other
    // is how you end up with two voices reading different balances.
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(clean);
    u.lang = LANG;

    // Prefer an Indian English voice when the system has one. Falling back
    // silently is fine; the wrong accent is understandable, absence is not.
    const voice = window.speechSynthesis.getVoices()
      .find(v => v.lang === LANG)
      ?? window.speechSynthesis.getVoices().find(v => v.lang.startsWith('en-IN'));
    if (voice) u.voice = voice;

    u.rate = 1;
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, [supported, enabled]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { window.localStorage.setItem(VOICE_PREF_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      if (!next && hasApi) window.speechSynthesis.cancel();
      return next;
    });
  }, [hasApi]);

  // Leaving the panel mid-sentence should stop the voice, not let it finish
  // reading someone's balance to the room.
  useEffect(() => () => { if (hasApi) window.speechSynthesis.cancel(); }, [hasApi]);

  return { supported, enabled, speaking, toggle, speak, cancel };
}
