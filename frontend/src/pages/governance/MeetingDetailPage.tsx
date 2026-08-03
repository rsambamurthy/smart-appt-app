import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useGetMeetingQuery, useAddAgendaItemMutation, useDeleteAgendaItemMutation,
  useIssueNoticeMutation, useSetMeetingStatusMutation, useOpenVotingMutation,
  useCloseVotingMutation, useGetRegisterQuery, useMarkAttendanceMutation,
  useSaveMinutesMutation, AgendaItem,
} from '../../store/api/governanceApi';
import {
  card, btn, field, label, StatusPill, OutcomePill, TallyBar, QuorumTiles,
  MEETING_LABEL, fmtWhen,
} from './meetingUi';

// ── Agenda builder — draft only ───────────────────────────────────────────────

function AgendaBuilder({ meetingId }: { meetingId: string }) {
  const [add, { isLoading }] = useAddAgendaItemMutation();
  const [title, setTitle]         = useState('');
  const [desc, setDesc]           = useState('');
  const [isRes, setIsRes]         = useState(false);
  const [isSecret, setIsSecret]   = useState(false);
  const [threshold, setThreshold] = useState('50');

  const submit = async () => {
    if (!title.trim()) return;
    await add({
      meetingId, title: title.trim(), description: desc.trim() || undefined,
      is_resolution: isRes, is_secret: isRes && isSecret,
      pass_threshold_percent: isRes ? Number(threshold) : undefined,
    }).unwrap().catch(() => undefined);
    setTitle(''); setDesc(''); setIsRes(false); setIsSecret(false); setThreshold('50');
  };

  return (
    <div style={{ padding: '14px 16px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
      <input style={{ ...field, marginBottom: 8 }} value={title}
             onChange={e => setTitle(e.target.value)} placeholder="Agenda item" />
      <input style={{ ...field, marginBottom: 10 }} value={desc}
             onChange={e => setDesc(e.target.value)} placeholder="Detail (optional)" />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
        <input type="checkbox" checked={isRes} onChange={e => setIsRes(e.target.checked)} />
        Put this to a vote
      </label>

      {isRes && (
        <div style={{ marginTop: 10, paddingLeft: 24, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={label}>Majority needed</label>
            <select style={{ ...field, width: 150 }} value={threshold} onChange={e => setThreshold(e.target.value)}>
              <option value="50">Simple majority</option>
              <option value="66.67">Two thirds</option>
              <option value="75">Three quarters</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', marginTop: 18 }}>
            <input type="checkbox" checked={isSecret} onChange={e => setIsSecret(e.target.checked)} />
            Secret ballot
          </label>
        </div>
      )}

      <button onClick={submit} disabled={isLoading || !title.trim()}
        style={{ ...btn, marginTop: 12, background: '#2563eb', color: '#fff', border: 'none',
                 opacity: title.trim() ? 1 : 0.5 }}>
        Add item
      </button>
    </div>
  );
}

// ── One agenda row ────────────────────────────────────────────────────────────

function AgendaRow({ item, canRun, isDraft, onDelete }: {
  item: AgendaItem; canRun: boolean; isDraft: boolean; onDelete: (id: string) => void;
}) {
  const [openVoting]  = useOpenVotingMutation();
  const [closeVoting] = useCloseVotingMutation();

  const live = item.voting_status === 'OPEN';

  return (
    <div style={{
      padding: '13px 16px', borderBottom: '1px solid #f1f5f9',
      background: live ? '#eff6ff' : '#fff',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, color: live ? '#1d4ed8' : '#94a3b8', minWidth: 16 }}>{item.seq}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: live ? '#0c447c' : '#1e293b' }}>{item.title}</div>
          {item.description && (
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{item.description}</div>
          )}
          <div style={{ fontSize: 11.5, color: live ? '#185fa5' : '#94a3b8', marginTop: 3 }}>
            {item.is_resolution
              ? <>Resolution · {Number(item.pass_threshold_percent) === 50
                  ? 'simple majority'
                  : `${Number(item.pass_threshold_percent)}% needed`}
                  {item.is_secret && ' · secret ballot'}</>
              : 'For discussion'}
          </div>
        </div>

        {item.outcome && <OutcomePill outcome={item.outcome} />}
        {live && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                         background: '#b5d4f4', color: '#0c447c', whiteSpace: 'nowrap' }}>
            Voting open
          </span>
        )}

        {isDraft && (
          <button onClick={() => onDelete(item.id)}
            style={{ ...btn, padding: '4px 10px', minHeight: 30, fontSize: 12,
                     color: '#dc2626', border: '1px solid #fecaca' }}>
            Remove
          </button>
        )}
      </div>

      {item.is_resolution && !isDraft && (
        <div style={{ marginTop: 10, paddingLeft: 26 }}>
          {item.voting_status === 'CLOSED' || item.tally.total > 0
            ? <TallyBar tally={item.tally} />
            : <div style={{ fontSize: 12, color: '#94a3b8' }}>Voting has not opened</div>}

          {canRun && (
            <div style={{ marginTop: 8 }}>
              {item.voting_status === 'NOT_OPEN' && (
                <button onClick={() => openVoting(item.id)} style={{ ...btn, fontSize: 12, minHeight: 32 }}>
                  Open voting
                </button>
              )}
              {live && (
                <button onClick={() => closeVoting(item.id)}
                  style={{ ...btn, fontSize: 12, minHeight: 32, background: '#2563eb', color: '#fff', border: 'none' }}>
                  Close voting
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Attendance register ───────────────────────────────────────────────────────

function Register({ meetingId }: { meetingId: string }) {
  const { data } = useGetRegisterQuery(meetingId);
  const [mark] = useMarkAttendanceMutation();
  const rows = data?.data ?? [];
  const present = rows.filter(r => r.attended).length;

  const rsvpText = (r: typeof rows[number]) =>
    r.rsvp === 'YES' ? 'Said yes' : r.rsvp === 'NO' ? 'Said no'
    : r.rsvp === 'MAYBE' ? 'Maybe' : 'No reply';

  return (
    <div style={{ ...card, marginTop: 14, overflow: 'hidden' }}>
      <div style={{
        padding: '11px 16px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Attendance register</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{present} of {rows.length} present</span>
      </div>

      {rows.map(r => (
        // A div rather than a label: the app's global form styles hijack the
        // layout of a <label> and push its children around. The row is still
        // fully clickable.
        <div
          key={r.unit_id}
          role="button"
          tabIndex={0}
          onClick={() => mark({ id: meetingId, unit_id: r.unit_id, attended: !r.attended })}
          onKeyDown={e => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              mark({ id: meetingId, unit_id: r.unit_id, attended: !r.attended });
            }
          }}
          style={{
            display: 'grid',
            // Fixed checkbox column, flexible flat name, right-aligned status
            // that never wraps. One row per flat at any width.
            gridTemplateColumns: '22px minmax(0, 1fr) auto',
            alignItems: 'center', gap: 12,
            padding: '10px 16px', borderBottom: '1px solid #f8fafc',
            cursor: 'pointer',
            background: r.attended ? '#f0fdf4' : '#fff',
          }}
        >
          <input
            type="checkbox"
            checked={r.attended}
            onChange={() => { /* handled on the row */ }}
            onClick={e => e.stopPropagation()}
            readOnly
            style={{ margin: 0, width: 16, height: 16, cursor: 'pointer' }}
          />

          <span style={{
            fontSize: 13.5, fontWeight: 600, color: '#1e293b',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {r.flat_number}{r.block ? ` · ${r.block}` : ''}
            {r.answered_by && (
              <span style={{ fontWeight: 400, color: '#94a3b8' }}> · {r.answered_by}</span>
            )}
          </span>

          <span style={{
            fontSize: 12, whiteSpace: 'nowrap',
            color: r.rsvp === 'YES' ? '#15803d' : r.rsvp === 'NO' ? '#b91c1c' : '#94a3b8',
          }}>
            {rsvpText(r)}
          </span>
        </div>
      ))}

      {rows.length === 0 && (
        <div style={{ padding: '16px', fontSize: 13, color: '#94a3b8' }}>
          No flats on the register.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading } = useGetMeetingQuery(id, { pollingInterval: 15000, skip: !id });
  const [issueNotice, { isLoading: issuing }] = useIssueNoticeMutation();
  const [setStatus] = useSetMeetingStatusMutation();
  const [saveMinutes, { isLoading: savingMinutes }] = useSaveMinutesMutation();
  const [removeItem] = useDeleteAgendaItemMutation();

  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [minutes, setMinutes] = useState<string | null>(null);

  const m = data?.data;

  if (isLoading || !m) {
    return <Layout><div style={{ padding: '2rem', color: '#94a3b8' }}>Loading…</div></Layout>;
  }

  const isDraft = m.status === 'DRAFT';
  const canRun  = m.status === 'IN_PROGRESS';

  const notice = async () => {
    setMsg(null);
    try {
      const res = await issueNotice(id).unwrap();
      setMsg({
        kind: res.data.short_notice ? 'err' : 'ok',
        text: res.data.short_notice
          ? `Notice issued with only ${res.data.clear_days} days' notice, which is less than your configured period. This is recorded in the audit log.`
          : `Notice issued. Every resident has been told.`,
      });
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setMsg({ kind: 'err', text: err?.data?.detail ?? 'Could not issue the notice.' });
    }
  };

  const move = async (status: 'IN_PROGRESS' | 'CONCLUDED' | 'CANCELLED') => {
    setMsg(null);
    try { await setStatus({ id, status }).unwrap(); }
    catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setMsg({ kind: 'err', text: err?.data?.detail ?? 'Could not update the meeting.' });
    }
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[
        { label: 'Governance' }, { label: 'Meetings', path: '/governance/meetings' }, { label: m.title },
      ]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 860 }}>

        {msg && (
          <div style={{
            marginBottom: 14, padding: '11px 14px', borderRadius: 9, fontSize: 13.5,
            background: msg.kind === 'ok' ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${msg.kind === 'ok' ? '#86efac' : '#fcd34d'}`,
            color: msg.kind === 'ok' ? '#15803d' : '#92400e',
          }}>
            {msg.text}
          </div>
        )}

        {/* Header */}
        <div style={{ ...card, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                <StatusPill status={m.status} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{MEETING_LABEL[m.meeting_type]}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{m.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                {fmtWhen(m.scheduled_at)}{m.venue && ` · ${m.venue}`}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isDraft && (
                <button onClick={notice} disabled={issuing}
                  style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                  {issuing ? 'Issuing…' : 'Issue notice'}
                </button>
              )}
              {m.status === 'NOTICE_ISSUED' && (
                <button onClick={() => move('IN_PROGRESS')} style={{ ...btn, background: '#15803d', color: '#fff', border: 'none' }}>
                  Start meeting
                </button>
              )}
              {canRun && (
                <button onClick={() => move('CONCLUDED')} style={btn}>Conclude meeting</button>
              )}
            </div>
          </div>

          {isDraft && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
              Residents cannot see this yet. Issuing the notice fixes the agenda
              and the date, and tells everyone.
            </div>
          )}
        </div>

        {!isDraft && <QuorumTiles a={m.attendance} />}

        {/* Agenda */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Agenda</span>
            {!isDraft && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Fixed at notice</span>
            )}
          </div>

          {m.agenda_items.length === 0 && (
            <div style={{ padding: '18px 16px', fontSize: 13, color: '#94a3b8' }}>
              Nothing on the agenda yet.
            </div>
          )}

          {m.agenda_items.map(item => (
            <AgendaRow key={item.id} item={item} canRun={canRun} isDraft={isDraft}
                       onDelete={(itemId) => removeItem(itemId)} />
          ))}

          {isDraft && <AgendaBuilder meetingId={id} />}
        </div>

        {(m.status === 'NOTICE_ISSUED' || canRun) && <Register meetingId={id} />}

        {/* Minutes */}
        {m.status === 'CONCLUDED' && (
          <div style={{ ...card, marginTop: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
              Minutes
              {m.minutes_published_at && (
                <span style={{ fontWeight: 400, color: '#15803d', marginLeft: 8 }}>
                  · published {new Date(m.minutes_published_at).toLocaleDateString('en-IN')}
                </span>
              )}
            </div>
            <textarea
              style={{ ...field, minHeight: 200, fontFamily: 'inherit', lineHeight: 1.6 }}
              value={minutes ?? m.minutes_body ?? ''}
              onChange={e => setMinutes(e.target.value)}
              placeholder="Record what was decided…"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => saveMinutes({ id, body: minutes ?? m.minutes_body ?? '' })}
                disabled={savingMinutes} style={btn}>
                Save draft
              </button>
              <button onClick={() => saveMinutes({ id, body: minutes ?? m.minutes_body ?? '', publish: true })}
                disabled={savingMinutes}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                Publish to residents
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
