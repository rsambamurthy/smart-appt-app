import { useState, useMemo, useRef, useEffect, CSSProperties } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import QrScanner from '../../components/organisms/QrScanner';
import {
  useGetGateUnitsQuery, useGetGateBoardQuery,
  useLogWalkInMutation, useRecordEntryMutation, useRecordExitMutation,
  useLookupQrQuery, useLogDeliveryMutation, useMarkParcelCollectedMutation,
  useUploadVisitorPhotoMutation,
  DELIVERY_PROVIDERS,
  GateUnit, GateVisitor,
} from '../../store/api/visitorsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const flatLabel = (u: { flat_number: string; block: string | null } | null) =>
  !u ? '—' : u.block ? `${u.flat_number} · ${u.block}` : u.flat_number;

function timeOnly(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// "2h 15m" — a guard reads elapsed time faster than a timestamp.
function elapsed(iso: string | null) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
// Touch targets are deliberately large: this is used one-handed on a phone at a
// gate, often in poor light.

const card: CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
};
const sectionHead: CSSProperties = {
  padding: '11px 16px', borderBottom: '1px solid #f1f5f9',
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
};
const bigBtn: CSSProperties = {
  padding: '11px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
  fontSize: 14, fontWeight: 600, minHeight: 44,
};
const field: CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 9,
  fontSize: 15, color: '#1e293b', background: '#fff', outline: 'none', minHeight: 44,
  boxSizing: 'border-box',
};
const label: CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.04em', display: 'block', marginBottom: 5,
};

// ── Count tile ────────────────────────────────────────────────────────────────
function Tile({ n, label: text, color, bg }: { n: number; label: string; color: string; bg: string }) {
  return (
    <div style={{ flex: '1 1 90px', background: bg, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 2 }}>{text}</div>
    </div>
  );
}

// ── Visitor row ───────────────────────────────────────────────────────────────
function VisitorRow({ v, action }: { v: GateVisitor; action?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
      borderBottom: '1px solid #f8fafc', flexWrap: 'wrap',
    }}>
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#1e293b' }}>
          {v.visitor_name}
          {v.overstaying && (
            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 7px', borderRadius: 99 }}>
              overstaying
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
          Flat {flatLabel(v.unit)}
          {v.purpose && ` · ${v.purpose}`}
          {v.vehicle_number && ` · ${v.vehicle_number}`}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {v.entered_at
          ? <>in {timeOnly(v.entered_at)}<br /><span style={{ fontWeight: 600, color: '#475569' }}>{elapsed(v.entered_at)}</span></>
          : v.expected_at ? `expected ${timeOnly(v.expected_at)}` : timeOnly(v.created_at)}
      </div>
      {action}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GateDashboardPage() {
  const [search, setSearch]   = useState('');
  const [unitId, setUnitId]   = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [qrToken, setQrToken]   = useState('');
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg]         = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Visitor vs delivery. Deliveries skip approval entirely.
  const [mode, setMode]         = useState<'VISITOR' | 'DELIVERY'>('VISITOR');
  const [provider, setProvider] = useState('');
  const [handling, setHandling] = useState<'AT_GATE' | 'SENT_UP'>('AT_GATE');

  // Photo is captured before saving and uploaded once the visitor exists.
  const [photo, setPhoto]       = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const bannerRef  = useRef<HTMLDivElement>(null);

  // Bring the outcome into view. The banner is at the top of a long page and
  // the gate is looking at the bottom of the form when they tap Save.
  useEffect(() => {
    if (msg) bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msg]);

  const takePhoto = (f: File | null) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(f);
    setPhotoUrl(f ? URL.createObjectURL(f) : null);
  };

  const { data: unitsData } = useGetGateUnitsQuery();
  // Polled rather than socket-driven: a gate phone drops connection constantly,
  // and a 15-second refresh is well within what this screen needs.
  const { data: boardData, refetch } = useGetGateBoardQuery(undefined, { pollingInterval: 15000 });

  const [logWalkIn,   { isLoading: logging }] = useLogWalkInMutation();
  const [recordEntry, { isLoading: entering }] = useRecordEntryMutation();
  const [recordExit,  { isLoading: exiting }]  = useRecordExitMutation();
  const [logDelivery, { isLoading: delivering }] = useLogDeliveryMutation();
  const [markCollected] = useMarkParcelCollectedMutation();
  const [uploadPhoto]   = useUploadVisitorPhotoMutation();
  const { data: qrData } = useLookupQrQuery(qrToken, { skip: qrToken.trim().length < 6 });

  const units: GateUnit[] = unitsData?.data ?? [];
  const board = boardData?.data;

  /**
   * Empty search shows the whole directory rather than nothing.
   *
   * The field used to require a query before it would show anything, which
   * assumed the guard already knew the flat number or the resident's name. At
   * a gate that assumption fails constantly — a visitor says "third floor, the
   * corner one", or gives a name that is not the registered occupant. Being
   * able to open the list and look is the ordinary case, not the fallback.
   *
   * No cap either. Truncating at eight is invisible: the guard sees a short
   * list and concludes the flat is not registered.
   */
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter(u =>
      u.flat_number.toLowerCase().includes(q) ||
      (u.block ?? '').toLowerCase().includes(q) ||
      (u.primary_contact ?? '').toLowerCase().includes(q),
    );
  }, [search, units]);

  // Grouped under block headings so a long directory can be scanned rather
  // than read. Units arrive sorted by block then flat, so this preserves order.
  const grouped = useMemo(() => {
    const out: Array<{ block: string; units: GateUnit[] }> = [];
    for (const u of matches) {
      const key = u.block ?? '';
      const last = out[out.length - 1];
      if (last && last.block === key) last.units.push(u);
      else out.push({ block: key, units: [u] });
    }
    return out;
  }, [matches]);

  const selected = units.find(u => u.id === unitId) ?? null;

  // A dropdown left open under a thumb hides the rest of the form, and on a
  // gate handset the form is the whole job.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const resetForm = () => {
    setUnitId(''); setSearch(''); setPickerOpen(false);
    setName(''); setPhone(''); setPurpose(''); setVehicle('');
    setProvider(''); setHandling('AT_GATE'); takePhoto(null);
    if (photoInput.current) photoInput.current.value = '';
  };

  // The photo is attached after the row exists, so it takes the file as an
  // argument rather than reading state — by the time it runs the form has
  // already been cleared. A failed upload must not read as a failed entry.
  const sendPhoto = async (visitorId: string, file: File | null) => {
    if (!file) return;
    try {
      await uploadPhoto({ id: visitorId, photo: file }).unwrap();
    } catch {
      setMsg(m => m
        ? { ...m, text: `${m.text} (the photo did not upload — the entry is still logged)` }
        : m);
    }
  };

  const submitWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!unitId) { setMsg({ kind: 'err', text: 'Choose the flat.' }); return; }

    // Held before the form is cleared: the confirmation names the visitor and
    // the flat, and the photo upload needs the file after the reset.
    const flat          = selected?.flat_number ?? 'the flat';
    const who           = name.trim();
    const pendingPhoto  = photo;
    const thisProvider  = provider;
    const thisHandling  = handling;

    try {
      if (mode === 'DELIVERY') {
        if (!thisProvider) { setMsg({ kind: 'err', text: 'Choose the delivery company.' }); return; }
        const res = await logDelivery({
          unit_id:       unitId,
          provider:      thisProvider,
          courier_name:  who || undefined,
          courier_phone: phone.trim() || undefined,
          handling:      thisHandling,
          note:          purpose.trim() || undefined,
        }).unwrap();

        // Clear and confirm the moment the parcel is recorded. Everything
        // after this is a side effect, and the gate is already onto the next
        // person at the barrier.
        resetForm();
        setMsg({
          kind: 'ok',
          text: thisHandling === 'AT_GATE'
            ? `${thisProvider} parcel held at the gate for flat ${flat}. Resident notified.`
            : `${thisProvider} sent up to flat ${flat}.`,
        });
        refetch();
        await sendPhoto(res.data.id, pendingPhoto);
      } else {
        if (!who) { setMsg({ kind: 'err', text: "Enter the visitor's name." }); return; }
        const res = await logWalkIn({
          visitor_name:   who,
          visitor_phone:  phone.trim() || undefined,
          unit_id:        unitId,
          purpose:        purpose.trim() || undefined,
          vehicle_number: vehicle.trim() || undefined,
        }).unwrap();

        resetForm();
        setMsg({ kind: 'ok', text: `${who} logged for flat ${flat}. Waiting for approval.` });
        refetch();

        const created = (res as { data?: { id?: string } }).data;
        if (created?.id) await sendPhoto(created.id, pendingPhoto);
      }
    } catch (err: unknown) {
      const e2 = err as { data?: { detail?: string; message?: string } };
      setMsg({ kind: 'err', text: e2?.data?.detail ?? e2?.data?.message ?? 'Could not log this.' });
    }
  };

  const doCollected = async (v: GateVisitor) => {
    setMsg(null);
    try {
      await markCollected(v.id).unwrap();
      setMsg({ kind: 'ok', text: `Parcel for flat ${flatLabel(v.unit)} collected.` });
      refetch();
    } catch (err: unknown) {
      const e2 = err as { data?: { detail?: string; message?: string } };
      setMsg({ kind: 'err', text: e2?.data?.detail ?? e2?.data?.message ?? 'Could not update the parcel.' });
    }
  };

  const doEntry = async (v: GateVisitor) => {
    setMsg(null);
    try {
      await recordEntry(v.id).unwrap();
      setMsg({ kind: 'ok', text: `${v.visitor_name} entered.` });
      refetch();
    } catch (err: unknown) {
      const e2 = err as { data?: { detail?: string; message?: string } };
      setMsg({ kind: 'err', text: e2?.data?.detail ?? e2?.data?.message ?? 'Could not record entry.' });
    }
  };

  const doExit = async (v: GateVisitor) => {
    setMsg(null);
    try {
      await recordExit(v.id).unwrap();
      setMsg({ kind: 'ok', text: `${v.visitor_name} exited.` });
      refetch();
    } catch (err: unknown) {
      const e2 = err as { data?: { detail?: string; message?: string } };
      setMsg({ kind: 'err', text: e2?.data?.detail ?? e2?.data?.message ?? 'Could not record exit.' });
    }
  };

  const qrVisitor = qrData?.data as GateVisitor | undefined;

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Visitors' }, { label: 'Gate' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 1100, margin: '0 auto' }}>

        {/* Counts */}
        {board && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Tile n={board.counts.inside}   label="Inside now"   color="#1d4ed8" bg="#eff6ff" />
            <Tile n={board.counts.awaiting} label="Awaiting"     color="#b45309" bg="#fffbeb" />
            <Tile n={board.counts.approved} label="Cleared"      color="#15803d" bg="#f0fdf4" />
            <Tile n={board.counts.today}    label="Today"        color="#475569" bg="#f8fafc" />
            {board.counts.parcels > 0 && (
              <Tile n={board.counts.parcels} label="Parcels" color="#c2410c" bg="#fff7ed" />
            )}
            {board.counts.overstaying > 0 && (
              <Tile n={board.counts.overstaying} label="Overstaying" color="#dc2626" bg="#fef2f2" />
            )}
          </div>
        )}

        {/* Result banner.
            It sits above the counts and the form, which on a phone means it
            can render a full screen above the submit button the gate just
            tapped — so it gets scrolled to. Without that it looks like
            nothing happened at all. */}
        {msg && (
          <div ref={bannerRef} style={{
            marginBottom: 14, padding: '11px 14px', borderRadius: 9, fontSize: 13.5,
            background: msg.kind === 'ok' ? '#f0fdf4' : '#fef2f2',
            border:     `1px solid ${msg.kind === 'ok' ? '#86efac' : '#fecaca'}`,
            color:      msg.kind === 'ok' ? '#15803d' : '#b91c1c',
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── Log a walk-in ── */}
          <div style={{ ...card, flex: '1 1 340px' }}>
            {/* Visitor or delivery. A delivery needs no approval, so the two
                paths differ enough to be an explicit choice rather than a
                guess from the purpose field. */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
              {(['VISITOR', 'DELIVERY'] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => { setMode(m); setMsg(null); }}
                  style={{
                    flex: 1, padding: '13px 10px', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: mode === m ? 700 : 500, minHeight: 48,
                    background: mode === m ? '#fff' : '#f8fafc',
                    color:      mode === m ? '#1e293b' : '#64748b',
                    borderBottom: mode === m ? '2px solid #2563eb' : '2px solid transparent',
                  }}>
                  {m === 'VISITOR' ? 'Visitor' : 'Delivery'}
                </button>
              ))}
            </div>
            <form onSubmit={submitWalkIn} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>

              {/* Flat — searchable, never a raw id */}
              <div style={{ position: 'relative' }}>
                <label style={label}>Flat *</label>
                {selected ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 12px', border: '1px solid #2563eb', borderRadius: 9, background: '#eff6ff',
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                      {selected.flat_number}{selected.block ? ` · ${selected.block}` : ''}
                      {selected.primary_contact && (
                        <span style={{ fontWeight: 400, color: '#64748b', fontSize: 13 }}> · {selected.primary_contact}</span>
                      )}
                    </span>
                    <button type="button" onClick={() => { setUnitId(''); setSearch(''); setPickerOpen(true); }}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div ref={pickerRef}>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{ ...field, paddingRight: 38 }}
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPickerOpen(true); }}
                        onFocus={() => setPickerOpen(true)}
                        placeholder="Tap to choose, or type a flat or name"
                        autoComplete="off"
                      />
                      {/* Reads as a dropdown, because that is what it is. */}
                      <button type="button"
                        onClick={() => setPickerOpen(o => !o)}
                        aria-label={pickerOpen ? 'Close flat list' : 'Show all flats'}
                        style={{
                          position: 'absolute', right: 1, top: 1, bottom: 1, width: 36,
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: '#64748b', fontSize: 12, lineHeight: 1,
                        }}>
                        {pickerOpen ? '▲' : '▼'}
                      </button>
                    </div>

                    {pickerOpen && (
                      <div style={{
                        position: 'absolute', zIndex: 20, left: 0, right: 0, marginTop: 4,
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9,
                        boxShadow: '0 8px 20px rgba(0,0,0,0.10)', maxHeight: 300, overflowY: 'auto',
                      }}>
                        {matches.length === 0 ? (
                          <div style={{ padding: '13px', fontSize: 13.5, color: '#64748b' }}>
                            No flat matches “{search.trim()}”.
                          </div>
                        ) : grouped.map(g => (
                          <div key={g.block || '_'}>
                            {g.block && (
                              <div style={{
                                position: 'sticky', top: 0, background: '#f8fafc',
                                padding: '5px 13px', fontSize: 11, fontWeight: 700,
                                color: '#94a3b8', textTransform: 'uppercase',
                                letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9',
                              }}>
                                {g.block}
                              </div>
                            )}
                            {g.units.map(u => (
                              <button key={u.id} type="button"
                                onClick={() => { setUnitId(u.id); setSearch(''); setPickerOpen(false); }}
                                style={{
                                  display: 'block', width: '100%', textAlign: 'left', padding: '11px 13px',
                                  border: 'none', borderBottom: '1px solid #f8fafc', background: '#fff',
                                  cursor: 'pointer', fontSize: 14.5, minHeight: 44,
                                }}>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {u.flat_number}
                                </span>
                                {u.primary_contact && (
                                  <span style={{ color: '#64748b', fontSize: 13 }}> — {u.primary_contact}</span>
                                )}
                                {u.occupant_count === 0 && (
                                  <span style={{ color: '#dc2626', fontSize: 12 }}> · nobody registered</span>
                                )}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                      {units.length} flats
                      {search.trim() && matches.length !== units.length && ` · ${matches.length} matching`}
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery: company and what happened to the parcel */}
              {mode === 'DELIVERY' && (
                <>
                  <div>
                    <label style={label}>Delivery company *</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {DELIVERY_PROVIDERS.map(p => (
                        <button key={p} type="button" onClick={() => setProvider(p)}
                          style={{
                            padding: '9px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 13.5,
                            minHeight: 40,
                            fontWeight: provider === p ? 700 : 500,
                            border: `1px solid ${provider === p ? '#2563eb' : '#cbd5e1'}`,
                            background: provider === p ? '#eff6ff' : '#fff',
                            color:      provider === p ? '#1d4ed8' : '#475569',
                          }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={label}>What happened to it *</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([
                        { id: 'AT_GATE', text: 'Left at gate' },
                        { id: 'SENT_UP', text: 'Sent up to flat' },
                      ] as const).map(h => (
                        <button key={h.id} type="button" onClick={() => setHandling(h.id)}
                          style={{
                            flex: 1, padding: '11px 10px', borderRadius: 9, cursor: 'pointer',
                            fontSize: 13.5, minHeight: 44,
                            fontWeight: handling === h.id ? 700 : 500,
                            border: `1px solid ${handling === h.id ? '#2563eb' : '#cbd5e1'}`,
                            background: handling === h.id ? '#eff6ff' : '#fff',
                            color:      handling === h.id ? '#1d4ed8' : '#475569',
                          }}>
                          {h.text}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label style={label}>
                  {mode === 'DELIVERY' ? 'Courier name' : 'Visitor name *'}
                </label>
                <input style={field} value={name} onChange={e => setName(e.target.value)}
                       placeholder={mode === 'DELIVERY' ? 'Optional' : 'Name'} />
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={label}>Phone</label>
                  <input style={field} value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="Optional" />
                </div>
                {mode === 'VISITOR' && (
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={label}>Vehicle</label>
                    <input style={field} value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="Optional" />
                  </div>
                )}
              </div>

              <div>
                <label style={label}>{mode === 'DELIVERY' ? 'Note' : 'Purpose'}</label>
                <input style={field} value={purpose} onChange={e => setPurpose(e.target.value)}
                       placeholder={mode === 'DELIVERY' ? 'Two boxes, fragile…' : 'Guest, service, interview…'} />
              </div>

              {/* Photo. capture="environment" opens the rear camera directly on
                  a phone; on a desktop it falls back to a file picker. */}
              <div>
                <label style={label}>Photo</label>
                {photoUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={photoUrl} alt="Captured"
                         style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 9, border: '1px solid #cbd5e1' }} />
                    <button type="button"
                      onClick={() => { takePhoto(null); if (photoInput.current) photoInput.current.value = ''; }}
                      style={{ ...bigBtn, background: '#fff', color: '#dc2626', border: '1px solid #fecaca', padding: '9px 16px' }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => photoInput.current?.click()}
                    style={{ ...bigBtn, width: '100%', background: '#fff', color: '#475569', border: '1px dashed #cbd5e1' }}>
                    Take photo (optional)
                  </button>
                )}
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => takePhoto(e.target.files?.[0] ?? null)}
                  style={{ display: 'none' }}
                />
              </div>

              <button type="submit" disabled={logging || delivering}
                style={{ ...bigBtn, background: '#2563eb', color: '#fff', opacity: (logging || delivering) ? 0.6 : 1 }}>
                {logging || delivering
                  ? 'Saving…'
                  : mode === 'DELIVERY' ? 'Log delivery & notify resident' : 'Log visitor & notify resident'}
              </button>
            </form>

            {/* QR / code lookup */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: 16 }}>
              <label style={label}>Pre-approved code</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...field, flex: 1 }} value={qrToken} onChange={e => setQrToken(e.target.value)}
                       placeholder="Scan or type the visitor's code" autoComplete="off" />
                <button type="button" onClick={() => setScanning(true)}
                  style={{
                    padding: '0 16px', minHeight: 44, borderRadius: 9, cursor: 'pointer',
                    border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8',
                    fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                  }}>
                  Scan
                </button>
              </div>
              {qrVisitor && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: '#1e293b' }}>{qrVisitor.visitor_name}</div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                    Flat {flatLabel(qrVisitor.unit)} · {qrVisitor.status}
                  </div>
                  {qrVisitor.status === 'APPROVED' && (
                    <button onClick={() => { doEntry(qrVisitor); setQrToken(''); }} disabled={entering}
                      style={{ ...bigBtn, background: '#15803d', color: '#fff', marginTop: 10, width: '100%' }}>
                      Allow entry
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Live board ── */}
          <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Cleared to enter */}
            <div style={card}>
              <div style={{ ...sectionHead, color: '#15803d', background: '#f0fdf4' }}>
                Cleared to enter {board ? `(${board.approved.length})` : ''}
              </div>
              {!board?.approved.length ? (
                <div style={{ padding: '16px', fontSize: 13, color: '#94a3b8' }}>Nobody waiting to come in.</div>
              ) : board.approved.map(v => (
                <VisitorRow key={v.id} v={v} action={
                  <button onClick={() => doEntry(v)} disabled={entering}
                    style={{ ...bigBtn, background: '#15803d', color: '#fff', padding: '9px 16px' }}>
                    Entry
                  </button>
                } />
              ))}
            </div>

            {/* Inside now */}
            <div style={card}>
              <div style={{ ...sectionHead, color: '#1d4ed8', background: '#eff6ff' }}>
                Inside now {board ? `(${board.inside.length})` : ''}
              </div>
              {!board?.inside.length ? (
                <div style={{ padding: '16px', fontSize: 13, color: '#94a3b8' }}>Nobody on the premises.</div>
              ) : board.inside.map(v => (
                <VisitorRow key={v.id} v={v} action={
                  <button onClick={() => doExit(v)} disabled={exiting}
                    style={{ ...bigBtn, background: '#fff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '9px 16px' }}>
                    Exit
                  </button>
                } />
              ))}
            </div>

            {/* Parcels held at the gate */}
            {!!board?.parcels.length && (
              <div style={card}>
                <div style={{ ...sectionHead, color: '#c2410c', background: '#fff7ed' }}>
                  Parcels at gate ({board.parcels.length})
                </div>
                {board.parcels.map(v => (
                  <VisitorRow key={v.id} v={v} action={
                    <button onClick={() => doCollected(v)}
                      style={{ ...bigBtn, background: '#c2410c', color: '#fff', padding: '9px 16px' }}>
                      Collected
                    </button>
                  } />
                ))}
              </div>
            )}

            {/* Awaiting the resident */}
            <div style={card}>
              <div style={{ ...sectionHead, color: '#b45309', background: '#fffbeb' }}>
                Awaiting resident approval {board ? `(${board.awaiting.length})` : ''}
              </div>
              {!board?.awaiting.length ? (
                <div style={{ padding: '16px', fontSize: 13, color: '#94a3b8' }}>Nothing pending.</div>
              ) : board.awaiting.map(v => (
                <VisitorRow key={v.id} v={v} action={
                  <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>waiting</span>
                } />
              ))}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, textAlign: 'center' }}>
          Updates every 15 seconds.
        </div>
      </div>

      {/* Scanning fills the token box, which the lookup query already watches,
          so the visitor's details appear without another tap. */}
      {scanning && (
        <QrScanner
          onScan={value => { setQrToken(value); setScanning(false); }}
          onClose={() => setScanning(false)}
        />
      )}
    </Layout>
  );
}
