import { useState, useEffect } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import InboxLayout, { InboxRow } from './InboxLayout';
import {
  useListRegisterQuery, useGetUnitRegisterQuery,
  useAdmitMemberMutation, useTransferMembershipMutation,
  useAddHolderMutation, useSetPrimaryHolderMutation, useRemoveHolderMutation,
  useAddNomineeMutation, useRemoveNomineeMutation,
  Membership, HolderInput,
} from '../../store/api/governanceApi';
import { btn, field, label } from './meetingUi';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const today = () => new Date().toISOString().slice(0, 10);

const sectionHead: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  padding: '11px 16px 6px',
};

// ── Admit / transfer form ─────────────────────────────────────────────────────

function MemberForm({ unitId, mode, onDone }: {
  unitId: string; mode: 'ADMIT' | 'TRANSFER'; onDone: () => void;
}) {
  const [admit,    { isLoading: admitting }]    = useAdmitMemberMutation();
  const [transfer, { isLoading: transferring }] = useTransferMembershipMutation();

  const [on, setOn]         = useState(today());
  const [names, setNames]   = useState<HolderInput[]>([{ name: '' }]);
  const [primary, setPrimary] = useState(0);
  const [deed, setDeed]     = useState('');
  const [share, setShare]   = useState('');
  const [error, setError]   = useState<string | null>(null);

  const busy = admitting || transferring;

  const submit = async () => {
    setError(null);
    const holders = names.filter(h => h.name.trim());
    if (holders.length === 0) return setError('Name at least one member.');

    const common = {
      unitId, holders, primary_index: primary,
      share_percent: share ? Number(share) : null,
      deed_reference: deed.trim() || null,
    };

    try {
      if (mode === 'ADMIT') await admit({ ...common, admitted_on: on }).unwrap();
      else                  await transfer({ ...common, transferred_on: on }).unwrap();
      onDone();
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; message?: string } };
      setError(err?.data?.detail ?? err?.data?.message ?? 'Could not save.');
    }
  };

  return (
    <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
        {mode === 'ADMIT' ? 'Admit a member' : 'Record a transfer'}
      </div>

      {error && (
        <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                      background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 150px' }}>
          <label style={label}>{mode === 'ADMIT' ? 'Admitted on' : 'Transferred on'}</label>
          <input style={field} type="date" value={on} onChange={e => setOn(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label style={label}>Deed reference</label>
          <input style={field} value={deed} onChange={e => setDeed(e.target.value)} placeholder="Optional" />
        </div>
        <div style={{ flex: '0 1 110px' }}>
          <label style={label}>Share %</label>
          <input style={field} inputMode="decimal" value={share}
                 onChange={e => setShare(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <label style={label}>Members</label>
      {names.map((h, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
          <input
            style={{ ...field, flex: 1 }}
            value={h.name}
            onChange={e => setNames(names.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            placeholder={i === 0 ? 'Full name' : 'Joint holder'}
          />
          {/* Exactly one holder carries the flat's vote. A radio, not a
              checkbox, because the choice is exclusive by construction. */}
          <label className="inline-check" style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap' }}>
            <input type="radio" name="primary" checked={primary === i} onChange={() => setPrimary(i)} />
            Holds the vote
          </label>
          {names.length > 1 && (
            <button onClick={() => { setNames(names.filter((_, j) => j !== i)); setPrimary(0); }}
              style={{ ...btn, padding: '4px 10px', minHeight: 30, fontSize: 12,
                       color: '#dc2626', border: '1px solid #fecaca' }}>
              ✕
            </button>
          )}
        </div>
      ))}

      <button onClick={() => setNames([...names, { name: '' }])}
        style={{ ...btn, fontSize: 12, minHeight: 30, marginTop: 2 }}>
        Add joint holder
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={busy}
          style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
          {busy ? 'Saving…' : mode === 'ADMIT' ? 'Admit' : 'Record transfer'}
        </button>
        <button onClick={onDone} style={btn}>Cancel</button>
      </div>

      {mode === 'TRANSFER' && (
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 9, lineHeight: 1.6 }}>
          This closes the current membership on that date and opens a new one.
          The outgoing member stays on the register with a cessation date.
        </div>
      )}
    </div>
  );
}

// ── The member record ─────────────────────────────────────────────────────────

function MemberRecord({ unitId }: { unitId: string }) {
  const { data, isLoading } = useGetUnitRegisterQuery(unitId);
  const [addHolder]       = useAddHolderMutation();
  const [setPrimaryHolder] = useSetPrimaryHolderMutation();
  const [removeHolder]    = useRemoveHolderMutation();
  const [addNominee]      = useAddNomineeMutation();
  const [removeNominee]   = useRemoveNomineeMutation();

  const [form, setForm]         = useState<'ADMIT' | 'TRANSFER' | null>(null);
  const [jointName, setJoint]   = useState('');
  const [nomName, setNomName]   = useState('');
  const [nomRel, setNomRel]     = useState('');

  // Close any open form when the selected flat changes, or the transfer form
  // stays open over a different flat's record.
  useEffect(() => { setForm(null); }, [unitId]);

  if (isLoading || !data) {
    return <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>;
  }

  const { unit, current, history } = data.data;
  const m: Membership | null = current;

  return (
    <div>
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
            Flat {unit.flat_number}{unit.block ? ` · ${unit.block}` : ''}
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
            {m
              ? `Membership M-${String(m.member_no).padStart(3, '0')} · admitted ${fmtDate(m.admitted_on)}`
              : 'No member on the register'}
          </div>
        </div>
        {!form && (
          <button onClick={() => setForm(m ? 'TRANSFER' : 'ADMIT')}
            style={{ ...btn, ...(m ? {} : { background: '#2563eb', color: '#fff', border: 'none' }) }}>
            {m ? 'Record transfer' : 'Admit a member'}
          </button>
        )}
      </div>

      {form && <MemberForm unitId={unitId} mode={form} onDone={() => setForm(null)} />}

      {!m ? (
        <div style={{ padding: '18px 16px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          Nobody is recorded as the member for this flat. It still counts toward
          quorum at a general body meeting, but no vote can be cast for it in the
          app until a member is admitted.
        </div>
      ) : (
        <>
          {/* Holders */}
          <div style={sectionHead}>Members of record</div>
          {m.holders.map(h => (
            <div key={h.id} style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto',
              gap: 10, alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #f8fafc',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.name}
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  {h.user_id ? 'Has an app account' : 'No app account · votes in person'}
                </div>
              </div>

              {h.is_primary ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                               background: '#eff6ff', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                  Holds the vote
                </span>
              ) : (
                <button onClick={() => setPrimaryHolder({ membershipId: m.id, holderId: h.id })}
                  style={{ ...btn, padding: '3px 9px', minHeight: 28, fontSize: 11.5 }}>
                  Give the vote
                </button>
              )}

              {!h.is_primary ? (
                <button onClick={() => removeHolder({ membershipId: m.id, holderId: h.id })}
                  style={{ ...btn, padding: '3px 9px', minHeight: 28, fontSize: 11.5,
                           color: '#dc2626', border: '1px solid #fecaca' }}>
                  Remove
                </button>
              ) : <span />}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <input style={{ ...field, flex: 1 }} value={jointName}
                   onChange={e => setJoint(e.target.value)} placeholder="Add a joint holder" />
            <button disabled={!jointName.trim()}
              onClick={() => { addHolder({ membershipId: m.id, name: jointName.trim() }); setJoint(''); }}
              style={{ ...btn, opacity: jointName.trim() ? 1 : 0.5 }}>
              Add
            </button>
          </div>

          {/* Nominees */}
          <div style={sectionHead}>Nominees</div>
          {m.nominees.length === 0 && (
            <div style={{ padding: '4px 16px 8px', fontSize: 12.5, color: '#94a3b8' }}>
              None recorded. Most acts require a nomination, and its absence is a
              common cause of dispute on succession.
            </div>
          )}
          {m.nominees.map(n => (
            <div key={n.id} style={{
              display: 'flex', gap: 10, alignItems: 'center',
              padding: '8px 16px', borderBottom: '1px solid #f8fafc',
            }}>
              <span style={{ flex: 1, fontSize: 13.5, color: '#1e293b' }}>
                {n.name}
                {n.relationship && <span style={{ color: '#94a3b8' }}> · {n.relationship}</span>}
                <span style={{ color: '#cbd5e1' }}> · recorded {fmtDate(n.recorded_on)}</span>
              </span>
              <button onClick={() => removeNominee({ membershipId: m.id, nomineeId: n.id })}
                style={{ ...btn, padding: '3px 9px', minHeight: 28, fontSize: 11.5,
                         color: '#dc2626', border: '1px solid #fecaca' }}>
                Remove
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            <input style={{ ...field, flex: '2 1 160px' }} value={nomName}
                   onChange={e => setNomName(e.target.value)} placeholder="Nominee name" />
            <input style={{ ...field, flex: '1 1 110px' }} value={nomRel}
                   onChange={e => setNomRel(e.target.value)} placeholder="Relationship" />
            <button disabled={!nomName.trim()}
              onClick={() => {
                addNominee({ membershipId: m.id, name: nomName.trim(), relationship: nomRel.trim() || undefined });
                setNomName(''); setNomRel('');
              }}
              style={{ ...btn, opacity: nomName.trim() ? 1 : 0.5 }}>
              Add
            </button>
          </div>
        </>
      )}

      {/* History — what makes it a register rather than a list */}
      {history.length > 0 && (
        <>
          <div style={sectionHead}>Ownership history</div>
          {history.map(h => (
            <div key={h.id} style={{
              display: 'flex', gap: 12, padding: '9px 16px', borderBottom: '1px solid #f8fafc',
            }}>
              <span style={{ fontSize: 11.5, color: '#94a3b8', width: 96, flexShrink: 0 }}>
                {fmtDate(h.admitted_on)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {h.holders.map(x => x.name).join(', ')}
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  M-{String(h.member_no).padStart(3, '0')}
                  {h.ceased_on && ` · ceased ${fmtDate(h.ceased_on)}`}
                  {h.cessation_reason && ` · ${h.cessation_reason}`}
                  {h.deed_reference && ` · ${h.deed_reference}`}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [search, setSearch]   = useState('');
  const [q, setQ]             = useState('');
  const [gapsOnly, setGaps]   = useState(false);
  const [selected, setSelect] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useListRegisterQuery({ q, gaps: gapsOnly });
  const rows = data?.data ?? [];

  const toolbar = (
    <div style={{ padding: '9px 10px' }}>
      <input
        style={{ ...field, fontSize: 13, padding: '7px 9px', marginBottom: 8 }}
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Flat or member" autoComplete="off"
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => setGaps(false)}
          style={{
            padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11.5, border: 'none',
            fontWeight: gapsOnly ? 500 : 700,
            background: gapsOnly ? 'transparent' : '#eff6ff',
            color: gapsOnly ? '#64748b' : '#1d4ed8',
          }}>
          All {data?.total ?? 0}
        </button>
        <button onClick={() => setGaps(true)}
          style={{
            padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11.5, border: 'none',
            fontWeight: gapsOnly ? 700 : 500,
            background: gapsOnly ? '#fffbeb' : 'transparent',
            color: gapsOnly ? '#92400e' : '#64748b',
          }}>
          Gaps {data?.gaps ?? 0}
        </button>
      </div>
    </div>
  );

  const list = isLoading ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
  ) : rows.length === 0 ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Nothing matches.</div>
  ) : (
    <>
      {rows.map(r => (
        <InboxRow
          key={r.unit_id}
          selected={selected === r.unit_id}
          // Only a gap is coloured. A complete entry needs no attention.
          accent={r.has_member ? undefined : '#ba7517'}
          title={r.flat_number + (r.block ? ` · ${r.block}` : '')}
          trailing={r.member_no ? `M-${String(r.member_no).padStart(3, '0')}` : '—'}
          meta={r.has_member
            ? `${r.member_name}${r.joint_count ? ` +${r.joint_count}` : ''}`
            : 'No member recorded'}
          onClick={() => setSelect(r.unit_id)}
        />
      ))}
    </>
  );

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Governance' }, { label: 'Register of members' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        <InboxLayout
          toolbar={toolbar}
          list={list}
          detail={selected ? <MemberRecord unitId={selected} /> : null}
          placeholder="Select a flat to see its member, joint holders, nominee and ownership history."
        />
      </div>
    </Layout>
  );
}
