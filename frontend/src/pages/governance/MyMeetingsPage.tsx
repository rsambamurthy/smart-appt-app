import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListMyMeetingsQuery, useGetMeetingQuery, useRsvpMeetingMutation,
  useCastVoteMutation, RsvpStatus, VoteChoice, AgendaItem,
} from '../../store/api/governanceApi';
import { OutcomePill, TallyBar, MEETING_LABEL, fmtWhen } from './meetingUi';
import InboxLayout, { InboxRow } from './InboxLayout';

// ── One resolution, from the resident's side ──────────────────────────────────

function ResolutionCard({ item }: { item: AgendaItem }) {
  const [vote, { isLoading }] = useCastVoteMutation();
  const [error, setError] = useState<string | null>(null);

  const open = item.voting_status === 'OPEN';

  const cast = async (choice: VoteChoice) => {
    setError(null);
    try { await vote({ itemId: item.id, choice }).unwrap(); }
    catch (e: unknown) {
      const err = e as { data?: { detail?: string } };
      setError(err?.data?.detail ?? 'Could not record your vote.');
    }
  };

  const choiceBtn = (choice: VoteChoice, text: string, colour: string) => {
    const mine = item.my_vote === choice;
    return (
      <button key={choice} onClick={() => cast(choice)} disabled={isLoading}
        style={{
          flex: 1, minHeight: 44, borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          border: `1.5px solid ${mine ? colour : '#cbd5e1'}`,
          background: mine ? colour : '#fff',
          color: mine ? '#fff' : '#475569',
        }}>
        {text}
      </button>
    );
  };

  return (
    <div style={{
      padding: '13px 16px', borderBottom: '1px solid #f1f5f9',
      background: open ? '#eff6ff' : '#fff',
    }}>
      <div style={{ fontSize: 14, color: open ? '#0c447c' : '#1e293b' }}>
        {item.seq}. {item.title}
      </div>
      {item.description && (
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>{item.description}</div>
      )}

      {item.is_resolution && (
        <div style={{ fontSize: 11.5, color: open ? '#185fa5' : '#94a3b8', marginTop: 4 }}>
          {Number(item.pass_threshold_percent) === 50
            ? 'Simple majority'
            : `Needs ${Number(item.pass_threshold_percent)}% to pass`}
          {item.is_secret && ' · secret ballot'}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 8 }}>{error}</div>
      )}

      {open && (
        <>
          <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
            {choiceBtn('FOR', 'For', '#15803d')}
            {choiceBtn('AGAINST', 'Against', '#dc2626')}
            {choiceBtn('ABSTAIN', 'Abstain', '#64748b')}
          </div>
          <div style={{ fontSize: 11.5, color: '#185fa5', marginTop: 8 }}>
            You can change your vote until voting closes. One vote per flat.
          </div>
        </>
      )}

      {item.voting_status === 'CLOSED' && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {item.outcome && <OutcomePill outcome={item.outcome} />}
            {item.my_vote && (
              <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                Your flat voted {item.my_vote.toLowerCase()}
              </span>
            )}
          </div>
          {!item.is_secret && <TallyBar tally={item.tally} />}
        </div>
      )}

      {item.is_resolution && item.voting_status === 'NOT_OPEN' && (
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>Voting not open yet</div>
      )}
    </div>
  );
}

// ── Expanded meeting ──────────────────────────────────────────────────────────

function MeetingPanel({ meetingId }: { meetingId: string }) {
  const { data } = useGetMeetingQuery(meetingId, { pollingInterval: 20000 });
  const [rsvp] = useRsvpMeetingMutation();
  const m = data?.data;
  if (!m) return null;

  const canRsvp = m.status === 'NOTICE_ISSUED' || m.status === 'IN_PROGRESS';

  const rsvpBtn = (status: RsvpStatus, text: string) => {
    const mine = m.my_rsvp === status;
    return (
      <button key={status} onClick={() => rsvp({ id: meetingId, status })}
        style={{
          flex: 1, minHeight: 40, borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${mine ? '#15803d' : '#cbd5e1'}`,
          background: mine ? '#f0fdf4' : '#fff',
          color: mine ? '#15803d' : '#475569',
        }}>
        {text}
      </button>
    );
  };

  return (
    <div>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: '#1e293b' }}>{m.title}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
          {fmtWhen(m.scheduled_at)}{m.venue && ` · ${m.venue}`}
        </div>
      </div>

      {canRsvp && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 8 }}>
            Will your flat attend?
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {rsvpBtn('YES', 'Yes')}
            {rsvpBtn('MAYBE', 'Maybe')}
            {rsvpBtn('NO', 'No')}
          </div>
        </div>
      )}

      {m.notice_body && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                      fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {m.notice_body}
        </div>
      )}

      {m.agenda_items.map(item => <ResolutionCard key={item.id} item={item} />)}

      {m.minutes_published_at && m.minutes_body && (
        <div style={{ padding: '13px 16px', background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Minutes</div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {m.minutes_body}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function MyMeetingsPage() {
  const { data, isLoading } = useListMyMeetingsQuery(undefined, { pollingInterval: 60000 });
  const [openId, setOpenId] = useState<string | null>(null);

  const meetings = data?.data ?? [];

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Meetings' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        <InboxLayout
          list={isLoading ? (
            <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : meetings.length === 0 ? (
            <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>
              No meetings have been called.
            </div>
          ) : (
            <>
              {meetings.map(m => {
                const done = m.status === 'CONCLUDED' || m.status === 'CANCELLED';
                return (
                  <InboxRow
                    key={m.id}
                    selected={openId === m.id}
                    // Only a meeting wanting something from you gets a colour.
                    accent={m.open_votes ? '#2563eb' : undefined}
                    muted={done}
                    title={m.title}
                    trailing={shortDate(m.scheduled_at)}
                    meta={<>
                      {m.committee ? m.committee.name : MEETING_LABEL[m.meeting_type]}
                      {!!m.open_votes && ` · ${m.open_votes} to vote on`}
                      {!m.open_votes && m.my_rsvp === null && !done && ' · not answered'}
                    </>}
                    onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  />
                );
              })}
            </>
          )}
          detail={openId ? <MeetingPanel meetingId={openId} /> : null}
          placeholder="Select a meeting to read the agenda and vote."
        />
      </div>
    </Layout>
  );
}
