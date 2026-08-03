import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import InboxLayout, { InboxRow } from './InboxLayout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListCommitteesQuery, useListCommitteeMembersQuery, useCreateCommitteeMutation,
  useAddCommitteeMemberMutation, useRemoveCommitteeMemberMutation,
} from '../../store/api/governanceApi';
import { useListUsersQuery } from '../../store/api/usersApi';
import { card, btn, field, label } from './meetingUi';

interface UserRow { id: string; name: string; role: string; unit?: { flat_number: string } | null }

// ── Members of one committee ──────────────────────────────────────────────────

function Members({ committeeId, isManaging, name }: {
  committeeId: string; isManaging: boolean; name: string;
}) {
  const { data, isLoading } = useListCommitteeMembersQuery(committeeId);
  const { data: usersData } = useListUsersQuery({ limit: 500 }, { skip: isManaging });
  const [addMember, { isLoading: adding }] = useAddCommitteeMemberMutation();
  const [removeMember] = useRemoveCommitteeMemberMutation();

  const [pick, setPick]         = useState('');
  const [convenor, setConvenor] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const members = data?.data ?? [];
  const users   = (usersData?.data ?? []) as UserRow[];
  const memberIds = new Set(members.map(m => m.user_id));
  const available = users.filter(u => !memberIds.has(u.id));

  const add = async () => {
    if (!pick) return;
    setError(null);
    try {
      await addMember({ id: committeeId, user_id: pick, is_convenor: convenor }).unwrap();
      setPick(''); setConvenor(false);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not appoint them.');
    }
  };

  return (
    <div>
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{name}</div>
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
          {members.length} {members.length === 1 ? 'member' : 'members'}
          {' · quorum counts members, and each votes individually'}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>Loading…</div>
      ) : members.length === 0 ? (
        <div style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>
          No members yet. Nobody can vote in this committee's meetings until someone is appointed.
        </div>
      ) : members.map(m => (
        <div key={m.user_id} style={{
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto',
          alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid #f1f5f9',
        }}>
          <span style={{ fontSize: 13.5, color: '#1e293b', overflow: 'hidden',
                         textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.name}
            {m.flat_number && (
              <span style={{ color: '#94a3b8' }}> · {m.flat_number}</span>
            )}
          </span>

          {m.via ? (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                           background: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
              {m.via}
            </span>
          ) : m.is_convenor ? (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                           background: '#eff6ff', color: '#1d4ed8' }}>
              Convenor
            </span>
          ) : <span />}

          {!isManaging && (
            <button onClick={() => removeMember({ id: committeeId, userId: m.user_id })}
              style={{ ...btn, padding: '4px 10px', minHeight: 30, fontSize: 12,
                       color: '#dc2626', border: '1px solid #fecaca' }}>
              Step down
            </button>
          )}
        </div>
      ))}

      {isManaging ? (
        <div style={{ padding: '11px 16px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
          This roster is worked out, not edited. It is every manager, treasurer
          and committee member, plus the convenor of each sub-committee who is
          not already one of those. Change someone's role in Manage Users, or
          make them a convenor, and they appear here immediately.
        </div>
      ) : (
        <div style={{ padding: '12px 16px' }}>
          {error && (
            <div style={{ marginBottom: 8, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={{ ...field, flex: '1 1 200px', maxWidth: 280 }}
                    value={pick} onChange={e => setPick(e.target.value)}>
              <option value="">Appoint someone…</option>
              {available.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.unit?.flat_number ? ` · ${u.unit.flat_number}` : ''}
                </option>
              ))}
            </select>
            <label className="inline-check" style={{ fontSize: 13, color: '#475569' }}>
              <input type="checkbox" checked={convenor} onChange={e => setConvenor(e.target.checked)} />
              Convenor
            </label>
            <button onClick={add} disabled={!pick || adding}
              style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none',
                       opacity: pick ? 1 : 0.5 }}>
              Appoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommitteesPage() {
  const { data, isLoading } = useListCommitteesQuery();
  const [create, { isLoading: creating }] = useCreateCommitteeMutation();

  const [open, setOpen]   = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName]   = useState('');
  const [desc, setDesc]   = useState('');
  const [error, setError] = useState<string | null>(null);

  const committees = data?.data ?? [];
  const selectedCommittee = committees.find(c => c.id === open) ?? null;

  const submit = async () => {
    setError(null);
    try {
      await create({ name: name.trim(), description: desc.trim() || undefined }).unwrap();
      setName(''); setDesc(''); setAdding(false);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not create the committee.');
    }
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Governance' }, { label: 'Committees' }]} />

      {/* No maxWidth: the reading pane needs the room. The explanatory line
          moved into the pane header, where it is read at the moment it
          matters rather than above a list. */}
      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        {!adding ? (
          <button onClick={() => setAdding(true)}
            style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', marginBottom: 16 }}>
            New committee
          </button>
        ) : (
          <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
            {error && (
              <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Name</label>
              <input style={field} value={name} onChange={e => setName(e.target.value)}
                     placeholder="Water and sewerage" />
            </div>
            <div>
              <label style={label}>What it does</label>
              <input style={field} value={desc} onChange={e => setDesc(e.target.value)}
                     placeholder="Optional" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={submit} disabled={creating || !name.trim()}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none',
                         opacity: name.trim() ? 1 : 0.5 }}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => { setAdding(false); setError(null); }} style={btn}>Cancel</button>
            </div>
          </div>
        )}

        <InboxLayout
          list={isLoading ? (
            <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {committees.map(c => (
                <InboxRow
                  key={c.id}
                  selected={open === c.id}
                  // The managing committee is the one that always exists and
                  // always matters, so it keeps an accent even when unselected.
                  accent={c.is_managing ? '#7c3aed' : undefined}
                  title={c.name}
                  trailing={String(c.member_count)}
                  meta={c.is_managing ? 'Worked out from roles' : (c.description || 'Sub-committee')}
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                />
              ))}
            </>
          )}
          detail={selectedCommittee
            ? <Members
                committeeId={selectedCommittee.id}
                isManaging={selectedCommittee.is_managing}
                name={selectedCommittee.name}
              />
            : null}
          placeholder="Select a committee to see and change who sits on it."
        />
      </div>
    </Layout>
  );
}
