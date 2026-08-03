import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import InboxLayout, { InboxRow } from './InboxLayout';
import {
  useListElectionsQuery, useGetElectionQuery, useCreateElectionMutation,
  useSetElectionStatusMutation, useDeclareElectionMutation,
  useSecondNominationMutation, useAcceptNominationMutation,
  useWithdrawNominationMutation, useCastBallotMutation,
  useListCommitteesQuery, useListRegisterQuery, useProposeCandidateMutation,
  ElectionStatus, Candidate,
} from '../../store/api/governanceApi';
import { card, btn, field, label } from './meetingUi';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const PHASES: { id: ElectionStatus; label: string }[] = [
  { id: 'NOMINATIONS_OPEN', label: 'Nominations' },
  { id: 'VOTING_OPEN',      label: 'Voting' },
  { id: 'DECLARED',         label: 'Result' },
];

const ORDER: ElectionStatus[] = [
  'DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED',
  'VOTING_OPEN', 'VOTING_CLOSED', 'DECLARED',
];

const NOMINATION_LOOK: Record<string, { text: string; bg: string; fg: string }> = {
  PROPOSED:  { text: 'Needs a seconder', bg: '#fffbeb', fg: '#92400e' },
  SECONDED:  { text: 'Awaiting acceptance', bg: '#eff6ff', fg: '#1d4ed8' },
  ACCEPTED:  { text: 'Standing',          bg: '#f0fdf4', fg: '#15803d' },
  WITHDRAWN: { text: 'Withdrew',          bg: '#f8fafc', fg: '#64748b' },
  REJECTED:  { text: 'Ruled ineligible',  bg: '#fef2f2', fg: '#b91c1c' },
};

/** Where the election has got to. Reads left to right like a form. */
function PhaseStrip({ status }: { status: ElectionStatus }) {
  const at = ORDER.indexOf(status);

  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
      {PHASES.map((p, i) => {
        const idx  = ORDER.indexOf(p.id);
        const done = at > idx;
        const now  = at === idx || (p.id === 'NOMINATIONS_OPEN' && status === 'NOMINATIONS_CLOSED')
                                || (p.id === 'VOTING_OPEN' && status === 'VOTING_CLOSED');
        return (
          <div key={p.id} style={{
            flex: 1, textAlign: 'center', padding: '8px 6px',
            background: now ? '#eff6ff' : done ? '#f0fdf4' : '#f8fafc',
            borderRadius: i === 0 ? '8px 0 0 8px' : i === PHASES.length - 1 ? '0 8px 8px 0' : 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700,
                          color: now ? '#1d4ed8' : done ? '#15803d' : '#94a3b8' }}>
              {p.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── The ballot ────────────────────────────────────────────────────────────────

function Ballot({ electionId, seats, candidates }: {
  electionId: string; seats: number; candidates: Candidate[];
}) {
  const [cast, { isLoading }] = useCastBallotMutation();
  const [picked, setPicked]   = useState<string[]>([]);
  const [error, setError]     = useState<string | null>(null);

  const toggle = (id: string) => setPicked(p =>
    p.includes(id) ? p.filter(x => x !== id) : p.length < seats ? [...p, id] : p);

  const submit = async () => {
    setError(null);
    if (!window.confirm(
      `Cast your flat's ballot for ${picked.length} candidate${picked.length === 1 ? '' : 's'}?\n\n` +
      `This cannot be changed — a secret ballot has no way to find yours again.`
    )) return;
    try { await cast({ id: electionId, candidate_ids: picked }).unwrap(); }
    catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not cast the ballot.');
    }
  };

  return (
    <div>
      <div style={{ padding: '10px 16px', background: '#eff6ff', fontSize: 12.5, color: '#1d4ed8' }}>
        Choose up to {seats}. {picked.length} selected.
      </div>

      {error && (
        <div style={{ margin: '10px 16px', padding: '9px 12px', borderRadius: 7, fontSize: 13,
                      background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {candidates.map(c => {
        const on = picked.includes(c.id);
        return (
          <label key={c.id} className="inline-check" style={{
            display: 'flex', gap: 10, padding: '11px 16px',
            borderBottom: '1px solid #f8fafc', cursor: 'pointer',
            background: on ? '#eff6ff' : '#fff', margin: 0,
          }}>
            <input type="checkbox" checked={on} onChange={() => toggle(c.id)}
                   disabled={!on && picked.length >= seats} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, color: on ? '#0c447c' : '#1e293b' }}>{c.user.name}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}> · {c.unit.flat_number}</span>
              {c.statement && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.statement}</div>
              )}
            </span>
          </label>
        );
      })}

      <div style={{ padding: '13px 16px' }}>
        <button onClick={submit} disabled={picked.length === 0 || isLoading}
          style={{ ...btn, width: '100%', background: '#2563eb', color: '#fff', border: 'none',
                   opacity: picked.length ? 1 : 0.5 }}>
          {isLoading ? 'Casting…' : 'Cast ballot'}
        </button>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
          Once cast it cannot be changed. The ballot carries no record of who cast
          it, so there is no way to find yours again.
        </div>
      </div>
    </div>
  );
}

/**
 * Nominate someone.
 *
 * The candidate list comes from the REGISTER, not the user list: only a member
 * of record may stand. Own flat is excluded — the point of a proposer is that
 * somebody else thinks you should stand — as is anyone already nominated.
 */
function NominateBox({ electionId, myUnitId, alreadyNominated }: {
  electionId: string; myUnitId: string | null; alreadyNominated: Set<string>;
}) {
  const { data } = useListRegisterQuery({});
  const [propose, { isLoading }] = useProposeCandidateMutation();
  const [pick, setPick]   = useState('');
  const [error, setError] = useState<string | null>(null);

  const eligible = (data?.data ?? []).filter(r =>
    r.has_member
    && r.member_user_id
    && r.unit_id !== myUnitId
    && !alreadyNominated.has(r.member_user_id),
  );

  const submit = async () => {
    setError(null);
    try {
      await propose({ id: electionId, user_id: pick }).unwrap();
      setPick('');
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not record the nomination.');
    }
  };

  if (!myUnitId) {
    return (
      <div style={{ padding: '10px 16px', fontSize: 12.5, color: '#94a3b8' }}>
        Your account is not linked to a flat, so you cannot propose a candidate.
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
      {error && (
        <div style={{ marginBottom: 8, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...field, flex: '1 1 220px', maxWidth: 320 }}
                value={pick} onChange={e => setPick(e.target.value)}>
          <option value="">Propose a candidate…</option>
          {eligible.map(r => (
            <option key={r.unit_id} value={r.member_user_id!}>
              {r.member_name} · {r.flat_number}
            </option>
          ))}
        </select>
        <button onClick={submit} disabled={!pick || isLoading}
          style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none',
                   opacity: pick ? 1 : 0.5 }}>
          Propose
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
        Only members on the register may stand, and not your own flat. Someone
        from a third flat must then second the nomination before the candidate
        can accept.
      </div>
      {eligible.length === 0 && (
        <div style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>
          Nobody is available to nominate. Members need to be on the register
          with a linked app account.
        </div>
      )}
    </div>
  );
}

// ── One election ──────────────────────────────────────────────────────────────

function ElectionDetailPane({ id, isOrganiser, isManager }: {
  id: string; isOrganiser: boolean; isManager: boolean;
}) {
  const { data, isLoading } = useGetElectionQuery(id, { pollingInterval: 30000 });
  const [setStatus]   = useSetElectionStatusMutation();
  const [declare]     = useDeclareElectionMutation();
  const [second]      = useSecondNominationMutation();
  const [accept]      = useAcceptNominationMutation();
  const [withdraw]    = useWithdrawNominationMutation();
  const me = useSelector((s: RootState) => s.auth.user);
  const [msg, setMsg] = useState<string | null>(null);

  if (isLoading || !data) {
    return <div style={{ padding: '2rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>;
  }

  const e = data.data;
  const standing = e.candidates.filter(c => c.status === 'ACCEPTED');

  const move = async (status: ElectionStatus) => {
    setMsg(null);
    try { await setStatus({ id, status }).unwrap(); }
    catch (err: unknown) {
      const x = err as { data?: { detail?: string } };
      setMsg(x?.data?.detail ?? 'Could not change the phase.');
    }
  };

  const doDeclare = async () => {
    setMsg(null);
    try {
      const res = await declare(id).unwrap();
      setMsg(res.data.roster_updated
        ? 'Result declared and the committee roster replaced.'
        : 'Result declared. This is the managing committee, whose roster follows user roles — give the winners the Committee role in Manage Users.');
    } catch (err: unknown) {
      const x = err as { data?: { detail?: string } };
      setMsg(x?.data?.detail ?? 'Could not declare the result.');
    }
  };

  return (
    <div>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{e.title}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
          {e.committee.name} · {e.seats} {e.seats === 1 ? 'seat' : 'seats'} ·
          term {fmtDate(e.term_starts_on)} to {fmtDate(e.term_ends_on)}
        </div>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <PhaseStrip status={e.status} />

        {msg && (
          <div style={{ marginBottom: 12, padding: '10px 13px', borderRadius: 8, fontSize: 13,
                        background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
            {msg}
          </div>
        )}

        <div style={{ fontSize: 12.5, color: '#64748b' }}>
          {e.turnout.voted} of {e.turnout.eligible} flats have voted
          {e.status === 'VOTING_OPEN' && ' · secret ballot, so no running count is shown'}
        </div>

        {isOrganiser && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {e.status === 'DRAFT' && (
              <button onClick={() => move('NOMINATIONS_OPEN')}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                Open nominations
              </button>
            )}
            {e.status === 'NOMINATIONS_OPEN' && (
              <button onClick={() => move('NOMINATIONS_CLOSED')} style={btn}>Close nominations</button>
            )}
            {e.status === 'NOMINATIONS_CLOSED' && (
              <>
                <button onClick={() => move('VOTING_OPEN')}
                  style={{ ...btn, background: '#15803d', color: '#fff', border: 'none' }}>
                  Open voting
                </button>
                <button onClick={() => move('NOMINATIONS_OPEN')} style={btn}>Reopen nominations</button>
              </>
            )}
            {e.status === 'VOTING_OPEN' && (
              <button onClick={() => move('VOTING_CLOSED')} style={btn}>Close voting</button>
            )}
            {e.status === 'VOTING_CLOSED' && isManager && (
              <button onClick={doDeclare}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                Declare the result
              </button>
            )}
          </div>
        )}
      </div>

      {/* The ballot, for a member who has not yet voted */}
      {e.status === 'VOTING_OPEN' && !e.my_vote_cast && standing.length > 0 && (
        <Ballot electionId={id} seats={e.seats} candidates={standing} />
      )}
      {e.status === 'VOTING_OPEN' && e.my_vote_cast && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', fontSize: 13, color: '#15803d' }}>
          Your flat's ballot has been cast.
        </div>
      )}

      {/* Results, once declared */}
      {e.results && (
        <>
          <div style={{ padding: '11px 16px 6px', fontSize: 11, fontWeight: 700,
                        color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Result
          </div>
          {e.results.standing.map(c => {
            const won = e.results!.elected.includes(c.id);
            return (
              <div key={c.id} style={{
                display: 'flex', gap: 10, alignItems: 'center',
                padding: '9px 16px', borderBottom: '1px solid #f8fafc',
                background: won ? '#f0fdf4' : '#fff',
              }}>
                <span style={{ flex: 1, fontSize: 13.5, color: '#1e293b' }}>
                  {c.user.name}
                  <span style={{ color: '#94a3b8' }}> · {c.unit.flat_number}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: won ? '#15803d' : '#94a3b8' }}>
                  {c.votes ?? 0}
                </span>
                {won && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                                 background: '#dcfce7', color: '#15803d' }}>
                    Elected
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Candidates and nominations */}
      {e.status !== 'DECLARED' && (
        <>
          <div style={{ padding: '11px 16px 6px', fontSize: 11, fontWeight: 700,
                        color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Candidates · {standing.length} standing for {e.seats}
          </div>

          {e.status === 'NOMINATIONS_OPEN' && (
            <NominateBox
              electionId={id}
              myUnitId={me?.unit_id ?? null}
              alreadyNominated={new Set(e.candidates.map(c => c.user.id))}
            />
          )}

          {e.candidates.length === 0 && (
            <div style={{ padding: '10px 16px 12px', fontSize: 13, color: '#94a3b8' }}>
              Nobody has been nominated yet.
            </div>
          )}

          {e.candidates.map(c => {
            const look = NOMINATION_LOOK[c.status];
            const mine = c.user.id === me?.id;
            const myFlat = me?.unit_id;
            const canSecond = e.status === 'NOMINATIONS_OPEN' && c.status === 'PROPOSED'
                           && myFlat && myFlat !== c.unit.id && myFlat !== c.proposed_by_unit_id;

            return (
              <div key={c.id} style={{
                display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                padding: '10px 16px', borderBottom: '1px solid #f8fafc',
              }}>
                <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 13.5, color: '#1e293b' }}>
                  {c.user.name}
                  <span style={{ color: '#94a3b8' }}> · {c.unit.flat_number}</span>
                </span>

                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                               background: look.bg, color: look.fg, whiteSpace: 'nowrap' }}>
                  {look.text}
                </span>

                {canSecond && (
                  <button onClick={() => second(c.id)}
                    style={{ ...btn, padding: '3px 10px', minHeight: 28, fontSize: 11.5 }}>
                    Second
                  </button>
                )}
                {mine && c.status === 'SECONDED' && (
                  <button onClick={() => accept({ candidateId: c.id })}
                    style={{ ...btn, padding: '3px 10px', minHeight: 28, fontSize: 11.5,
                             background: '#15803d', color: '#fff', border: 'none' }}>
                    Accept and stand
                  </button>
                )}
                {(mine || isOrganiser) && ['PROPOSED', 'SECONDED', 'ACCEPTED'].includes(c.status)
                  && e.status !== 'VOTING_OPEN' && (
                  <button onClick={() => withdraw({ candidateId: c.id, as_organiser: !mine })}
                    style={{ ...btn, padding: '3px 10px', minHeight: 28, fontSize: 11.5,
                             color: '#dc2626', border: '1px solid #fecaca' }}>
                    {mine ? 'Withdraw' : 'Rule ineligible'}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ElectionsPage() {
  const role = useSelector((s: RootState) => s.auth.user?.role);
  const isManager   = role === 'MANAGER' || role === 'SUPER_USER';
  const isOrganiser = isManager || role === 'COMMITTEE';

  const { data, isLoading } = useListElectionsQuery();
  const { data: committeeData } = useListCommitteesQuery();
  const [create, { isLoading: creating }] = useCreateElectionMutation();

  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen]     = useState(false);
  const [title, setTitle]   = useState('');
  const [cid, setCid]       = useState('');
  const [seats, setSeats]   = useState('5');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [error, setError]   = useState<string | null>(null);

  const elections  = data?.data ?? [];
  const committees = committeeData?.data ?? [];

  const submit = async () => {
    setError(null);
    try {
      const res = await create({
        committee_id: cid, title: title.trim(), seats: Number(seats),
        term_starts_on: from, term_ends_on: to,
      }).unwrap();
      setOpen(false); setTitle(''); setFrom(''); setTo('');
      setSelected(res.data.id);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not create the election.');
    }
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Governance' }, { label: 'Elections' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        {isManager && (open ? (
          <div style={{ ...card, padding: '16px 18px', marginBottom: 14, maxWidth: 640 }}>
            {error && (
              <div style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 7, fontSize: 13,
                            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={label}>Title</label>
              <input style={field} value={title} onChange={e => setTitle(e.target.value)}
                     placeholder="Managing committee election 2026–27" />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ flex: '2 1 200px' }}>
                <label style={label}>Committee</label>
                <select style={field} value={cid} onChange={e => setCid(e.target.value)}>
                  <option value="">Choose…</option>
                  {committees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <label style={label}>Seats</label>
                <input style={field} inputMode="numeric" value={seats}
                       onChange={e => setSeats(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={label}>Term starts</label>
                <input style={field} type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={label}>Term ends</label>
                <input style={field} type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={submit} disabled={creating || !title.trim() || !cid}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => { setOpen(false); setError(null); }} style={btn}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', marginBottom: 14 }}>
            Call an election
          </button>
        ))}

        <InboxLayout
          list={isLoading ? (
            <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : elections.length === 0 ? (
            <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>
              No elections yet.
            </div>
          ) : (
            <>
              {elections.map(e => (
                <InboxRow
                  key={e.id}
                  selected={selected === e.id}
                  accent={e.status === 'VOTING_OPEN' ? '#2563eb'
                        : e.status === 'NOMINATIONS_OPEN' ? '#ba7517' : undefined}
                  muted={e.status === 'DECLARED' || e.status === 'CANCELLED'}
                  title={e.title}
                  trailing={`${e.seats} seats`}
                  meta={<>
                    {e.committee.name} · {e.status.toLowerCase().replace(/_/g, ' ')}
                  </>}
                  onClick={() => setSelected(e.id)}
                />
              ))}
            </>
          )}
          detail={selected
            ? <ElectionDetailPane id={selected} isOrganiser={isOrganiser} isManager={isManager} />
            : null}
          placeholder="Select an election to nominate, vote or see the result."
        />
      </div>
    </Layout>
  );
}
