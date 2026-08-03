import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { IS_NATIVE } from '../../hooks/usePlatform';
import { usePreApproveVisitorMutation } from '../../store/api/visitorsApi';

/**
 * A datetime-local input will only display a value shaped exactly
 * 'YYYY-MM-DDTHH:mm'. Hand it anything else — an ISO string with seconds and a
 * Z, for instance — and it silently renders blank rather than complaining.
 *
 * So the picked value is held verbatim in state and converted to ISO once, on
 * submit. Converting on every keystroke is what emptied the field before, and
 * an empty required field is why the QR code never generated.
 */
/**
 * The pass itself.
 *
 * Until now this screen printed the raw 32-character token and called it a QR
 * code. It was not scannable, it overflowed its box so the resident could not
 * even read the whole thing, and there was no way to send it to anyone.
 *
 * The token is unchanged — it is rendered as a scannable image, with the text
 * kept below it as the fallback for the gate to type in.
 */
function QrToken({ token, name, whenIso }: { token: string; name: string; whenIso: string }) {
  const [png, setPng] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Generous error correction: this gets scanned off a phone screen at a
    // gate, often at an angle and in daylight.
    QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 2, width: 240 })
      .then(url => { if (!cancelled) setPng(url); })
      .catch(() => { /* the text below remains usable */ });
    return () => { cancelled = true; };
  }, [token]);

  const when = whenIso ? new Date(whenIso) : null;
  const whenText = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const shareText =
    `Your gate pass for ${whenText ?? 'your visit'}:\n${token}\n\nShow this code at the gate.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the token is on screen to read */ }
  };

  const share = async () => {
    // Present in the Capacitor WebView and on Android Chrome; absent on
    // desktop, where Copy is the sensible path anyway.
    if (navigator.share) {
      try { await navigator.share({ title: 'Gate pass', text: shareText }); } catch { /* dismissed */ }
    } else {
      copy();
    }
  };

  return (
    <>
      {png
        ? <img src={png} alt={`Gate pass QR code for ${name || 'visitor'}`}
               style={{ width: 220, height: 220, display: 'block', margin: '0 auto' }} />
        : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
            Preparing code…
          </div>}

      {whenText && (
        <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
          Expected {whenText}
        </div>
      )}

      {/* Kept readable: the gate console has a box to type this into, and an
          unbroken 32-character string will otherwise run off the card. */}
      <div style={{
        background: 'var(--color-bg)', padding: '0.75rem', borderRadius: 'var(--radius)',
        fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '1px',
        wordBreak: 'break-all', lineHeight: 1.5, marginTop: '0.75rem', color: '#334155',
      }}>
        {token}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem' }}>
        <button type="button" onClick={copy}
          style={{ flex: 1, padding: '10px', borderRadius: 8, minHeight: 44, cursor: 'pointer',
                   border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600 }}>
          {copied ? 'Copied' : 'Copy code'}
        </button>
        <button type="button" onClick={share}
          style={{ flex: 1, padding: '10px', borderRadius: 8, minHeight: 44, cursor: 'pointer',
                   border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600 }}>
          Share
        </button>
      </div>
    </>
  );
}

export default function PreApproveVisitorPage() {
  const navigate = useNavigate();
  const [preApprove, { isLoading }] = usePreApproveVisitorMutation();
  const [form, setForm] = useState({ name: '', phone: '', expected_at: '', purpose: '', vehicle_number: '' });
  const [result, setResult] = useState<{ qr_token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local time, as the browser would render it — used as the earliest arrival
  // the picker will accept. Pre-approving a visit in the past is always a slip.
  const nowLocal = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 'YYYY-MM-DDTHH:mm' is parsed as local time, which is what the resident
    // meant. The server stores UTC.
    const when = new Date(form.expected_at);
    if (Number.isNaN(when.getTime())) {
      setError('Choose when the visitor is expected.');
      return;
    }

    try {
      const res = await preApprove({ ...form, expected_at: when.toISOString() }).unwrap();
      setResult(res.data);
    } catch (err: unknown) {
      const e2 = err as { data?: { detail?: string; message?: string } };
      setError(e2?.data?.detail ?? e2?.data?.message ?? 'Could not pre-approve this visitor.');
    }
  };

  if (result) return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Visitors' }, { label: 'Pre-approve Visitor' }]} />
      <div className="card" style={{ maxWidth: 420, margin: '1rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
        <h2 style={{ marginBottom: '0.35rem' }}>Visitor Pre-Approved</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Show this at the gate, or send it to {form.name || 'your visitor'}.
        </p>

        <QrToken token={result.qr_token} name={form.name} whenIso={form.expected_at} />

        <button className="btn-primary" style={{ marginTop: '1rem' }}
          onClick={() => navigate(IS_NATIVE ? '/mobile/visitors' : '/dashboard')}>
          Done
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Visitors' }, { label: 'Pre-approve Visitor' }]} />
      <div className="page-header"><h1>Pre-approve Visitor</h1></div>
      <div className="card" style={{ maxWidth: 500 }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              marginBottom: 14, padding: '11px 14px', borderRadius: 9, fontSize: 13.5,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
            }}>
              {error}
            </div>
          )}

          {(['name', 'phone', 'purpose', 'vehicle_number'] as const).map((field) => (
            <div className="form-group" key={field}>
              <label>{field.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}{field === 'name' ? ' *' : ''}</label>
              <input type={field === 'phone' ? 'tel' : 'text'} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required={field === 'name'} />
            </div>
          ))}
          <div className="form-group">
            <label>Expected Arrival *</label>
            <input
              type="datetime-local"
              value={form.expected_at}
              min={nowLocal}
              onChange={(e) => setForm({ ...form, expected_at: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Generating...' : 'Generate QR'}</button>
        </form>
      </div>
    </Layout>
  );
}
