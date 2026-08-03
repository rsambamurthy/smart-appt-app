import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/**
 * Camera QR scanner, shown as a full-screen sheet.
 *
 * Two decoders, in order of preference:
 *
 *   1. BarcodeDetector — built into the Android WebView, hardware-accelerated,
 *      no bytes shipped. Not present everywhere, and on some devices it exists
 *      but supports no formats, so both are checked.
 *   2. jsQR — pure JavaScript over a canvas. Slower, works anywhere.
 *
 * getUserMedia needs a secure context. Capacitor is configured with
 * androidScheme 'https', so the WebView qualifies; a plain http:// dev server
 * on a phone would not, and the camera would simply never open.
 */

// BarcodeDetector is not in TypeScript's DOM types yet.
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
};

interface Props {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    // Guards against firing twice: a QR sits in frame for many frames, and the
    // decode loop would otherwise report the same code repeatedly.
    let handled = false;

    const finish = (value: string) => {
      if (handled) return;
      handled = true;
      onScan(value.trim());
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (err) {
        const name = (err as { name?: string })?.name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was denied. Allow it in Settings, or type the code instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Type the code instead.'
              : 'Could not start the camera. Type the code instead.',
        );
        return;
      }

      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      // iOS refuses to play an unmuted inline video without a gesture.
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      try { await video.play(); } catch { /* the loop below still reads frames */ }

      // ── Pick a decoder ──────────────────────────────────────────────────
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      let detector: BarcodeDetectorLike | null = null;
      if (Ctor) {
        try {
          const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
          if (formats.includes('qr_code')) detector = new Ctor({ formats: ['qr_code'] });
        } catch { detector = null; }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true }) ?? null;

      const tick = async () => {
        if (stopped || handled) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA && canvas && ctx) {
          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;

          if (detector) {
            try {
              const found = await detector.detect(canvas.width ? video : canvas);
              if (found.length > 0 && found[0]) { finish(found[0].rawValue); return; }
            } catch {
              detector = null; // fall through to jsQR from here on
            }
          }

          if (!detector) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height, {
              inversionAttempts: 'dontInvert',
            });
            if (found?.data) { finish(found.data); return; }
          }
        }

        frame = requestAnimationFrame(() => { void tick(); });
      };

      void tick();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onScan]);

  return (
    <div
      role="dialog"
      aria-label="Scan visitor QR code"
      style={{
        position: 'fixed', inset: 0, zIndex: 500, background: '#000',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: '#fff',
      }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Scan visitor code</span>
        <button onClick={onClose} aria-label="Close scanner"
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            fontSize: 15, borderRadius: 8, padding: '9px 16px', cursor: 'pointer', minHeight: 44,
          }}>
          Close
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {error ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 28, textAlign: 'center',
            color: '#fecaca', fontSize: 15, lineHeight: 1.5,
          }}>
            {error}
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted
                   style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* Aiming frame — people hold the phone far too close otherwise. */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(62vw, 260px)', aspectRatio: '1',
              border: '3px solid rgba(255,255,255,0.9)', borderRadius: 16,
              boxShadow: '0 0 0 100vmax rgba(0,0,0,0.45)',
            }} />
          </>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {!error && (
        <div style={{
          padding: '14px 20px max(20px, env(safe-area-inset-bottom))',
          color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center',
        }}>
          Hold the visitor's code inside the frame.
        </div>
      )}
    </div>
  );
}
