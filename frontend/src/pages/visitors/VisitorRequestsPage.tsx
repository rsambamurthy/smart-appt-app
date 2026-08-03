import { useState, useEffect, CSSProperties } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import { API_BASE } from '../../store/api/baseApi';
import {
  useGetMyVisitorRequestsQuery, useApproveVisitorMutation, GateVisitor,
} from '../../store/api/visitorsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const timeOnly = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

function waitingFor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED: { label: 'Approved', color: '#15803d', bg: '#f0fdf4' },
  DENIED:   { label: 'Denied',   color: '#dc2626', bg: '#fef2f2' },
  ENTERED:  { label: 'Inside',   color: '#1d4ed8', bg: '#eff6ff' },
  EXITED:   { label: 'Left',     color: '#64748b', bg: '#f8fafc' },
  PENDING:  { label: 'Waiting',  color: '#b45309', bg: '#fffbeb' },
};

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
};
// Large targets: this is usually answered on a phone, in a hurry.
const decisionBtn: CSSProperties = {
  flex: 1, padding: '13px 18px', borderRadius: 10, border: 'none',
  fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 48,
};

/**
 * The gate photo, if one was taken.
 *
 * It cannot go straight into <img src> because the endpoint needs the bearer
 * token, so it is fetched and turned into an object URL. The URL is revoked on
 * unmount — a resident may scroll past a dozen of these and the bytes would
 * otherwise sit in memory for the life of the tab.
 *
 * Anything going wrong renders nothing. A missing photo must never stand
 * between a resident and the Allow/Deny buttons.
 */
function VisitorPhoto({ visitorId, name }: { visitorId: string; name: string }) {
  const token = useSelector((s: RootState) => s.auth.access_token);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/visitors/${visitorId}/photo`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        /* no photo shown */
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visitorId, token]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt={`Photo of ${name} taken at the gate`}
      style={{
        width: 78, height: 78, borderRadius: 10, objectFit: 'cover',
        flexShrink: 0, background: '#f1f5f9', border: '1px solid #e2e8f0',
      }}
    />
  );
}

export default function VisitorRequestsPage() {
  const { data, isLoading, refetch } = useGetMyVisitorRequestsQuery(undefined, { pollingInterval: 20000 });
  const [decide, { isLoading: deciding }] = useApproveVisitorMutation();
  const [msg, setMsg] = useState<string | null>(null);

  const pending: GateVisitor[] = data?.data.pending ?? [];
  const recent:  GateVisitor[] = data?.data.recent  ?? [];

  const answer = async (v: GateVisitor, decision: 'APPROVED' | 'DENIED') => {
    setMsg(null);
    try {
      await decide({ id: v.id, decision }).unwrap();
      setMsg(decision === 'APPROVED'
        ? `${v.visitor_name} approved — the gate has been told.`
        : `${v.visitor_name} denied.`);
      refetch();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; message?: string } };
      setMsg(err?.data?.detail ?? err?.data?.message ?? 'Could not record your decision.');
    }
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Visitors' }, { label: 'Visitor Requests' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 640, margin: '0 auto' }}>

        {msg && (
          <div style={{
            marginBottom: 14, padding: '11px 14px', borderRadius: 9, fontSize: 13.5,
            background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d',
          }}>
            {msg}
          </div>
        )}

        {/* Waiting on me */}
        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Loading…</div>
        ) : pending.length === 0 ? (
          <div style={{ ...card, padding: '22px 20px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            No one is waiting at the gate for you.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map(v => (
              <div key={v.id} style={{ ...card, border: '1px solid #fcd34d' }}>
                <div style={{ padding: '14px 16px 12px', display: 'flex', gap: 12 }}>
                  {/* Seeing the face is the whole point of the decision, so the
                      photo sits next to the name rather than behind a tap. */}
                  {v.photo_captured_at && (
                    <VisitorPhoto visitorId={v.id} name={v.visitor_name} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{v.visitor_name}</div>
                    <div style={{ fontSize: 13.5, color: '#475569', marginTop: 3 }}>
                      {v.purpose || 'No purpose given'}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4 }}>
                      At the gate · {waitingFor(v.created_at)}
                      {v.visitor_phone && ` · ${v.visitor_phone}`}
                      {v.vehicle_number && ` · ${v.vehicle_number}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '0 16px 16px' }}>
                  <button onClick={() => answer(v, 'DENIED')} disabled={deciding}
                    style={{ ...decisionBtn, background: '#fff', color: '#dc2626', border: '1.5px solid #fecaca' }}>
                    Deny
                  </button>
                  <button onClick={() => answer(v, 'APPROVED')} disabled={deciding}
                    style={{ ...decisionBtn, background: '#15803d', color: '#fff' }}>
                    Allow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent */}
        {recent.length > 0 && (
          <div style={{ ...card, marginTop: 18 }}>
            <div style={{
              padding: '11px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc',
              fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Recent visitors to your flat
            </div>
            {recent.map(v => {
              const s = STATUS_STYLE[v.status] ?? STATUS_STYLE['PENDING'];
              return (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px', borderBottom: '1px solid #f8fafc',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{v.visitor_name}</div>
                    <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 1 }}>
                      {v.purpose || '—'} · {timeOnly(v.entered_at ?? v.created_at)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                    background: s.bg, color: s.color, whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, textAlign: 'center' }}>
          Refreshes every 20 seconds.
        </div>
      </div>
    </Layout>
  );
}
