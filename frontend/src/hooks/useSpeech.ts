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

export interface SpeechInput {
  supported:  boolean;
  listening:  boolean;
  /** What has been heard so far, including the unconfirmed tail. */
  transcript: string;
  error:      string;
  start:      () => void;
  stop:       () => void;
}

/**
 * Dictation.
 *
 * `onFinal` fires once the recogniser settles on a phrase. The caller decides
 * whether that submits or merely fills the box — this hook does not assume,
 * because auto-sending a misheard question is worse than one extra tap.
 */
export function useSpeechInput(onFinal?: (text: string) => void): SpeechInput {
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError]           = useState('');

  const recRef   = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  // Held in a ref so restarting the recogniser does not need a fresh closure
  // over a callback that changes identity on every parent render.
  const cbRef    = useRef(onFinal);
  useEffect(() => { cbRef.current = onFinal; }, [onFinal]);

  const supported = recognitionCtor() !== null;

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) { setError('Voice input is not available in this browser.'); return; }

    // Any previous session is abandoned rather than left running. Two live
    // recognisers produce interleaved transcripts and a microphone indicator
    // that never goes away.
    recRef.current?.abort();

    const rec = new Ctor();
    rec.lang            = LANG;
    rec.interimResults  = true;    // shows words as they land; the wait feels long otherwise
    rec.continuous      = false;   // one question, then stop — this is not dictation of a letter
    rec.maxAlternatives = 1;

    finalRef.current = '';
    setTranscript('');
    setError('');

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else           interim += r[0].transcript;
      }
      setTranscript((finalRef.current + interim).trimStart());
    };

    rec.onerror = (e) => {
      // 'no-speech' and 'aborted' are ordinary — someone opened the microphone
      // and thought better of it. Reporting those as errors trains people to
      // ignore the error line, which then hides a real one.
      if (e.error === 'no-speech' || e.error === 'aborted') { setListening(false); return; }
      setError(
        e.error === 'not-allowed'
          ? 'Microphone access was blocked. Allow it in your browser settings to use voice.'
          : 'Voice input stopped working. Please type instead.',
      );
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      const said = finalRef.current.trim();
      if (said) cbRef.current?.(said);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if called while already running. Not worth surfacing.
      setListening(false);
    }
  }, []);

  // A recogniser left running after the panel closes keeps the browser's
  // microphone indicator lit, which reads as the app listening in secret.
  useEffect(() => () => { recRef.current?.abort(); }, []);

  return { supported, listening, transcript, error, start, stop };
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
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [enabled, setEnabled]   = useState(readPref);
  const [speaking, setSpeaking] = useState(false);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

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
      if (!next && supported) window.speechSynthesis.cancel();
      return next;
    });
  }, [supported]);

  // Leaving the panel mid-sentence should stop the voice, not let it finish
  // reading someone's balance to the room.
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { supported, enabled, speaking, toggle, speak, cancel };
}
