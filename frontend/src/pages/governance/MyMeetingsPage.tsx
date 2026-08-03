import { useState } from 'react';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListMyMeetingsQuery, useGetMeetingQuery, useRsvpMeetingMutation,
  useCastVoteMutation, RsvpStatus, VoteChoice, AgendaItem,
} from '../../store/api/governanceApi';
import { card, StatusPill, OutcomePill, TallyBar, MEETING_LABEL, fmtWhen } from './meetingUi';

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
    <div style={{ borderTop: '1px solid #f1f5f9' }}>
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

export default function MyMeetingsPage() {
  const { data, isLoading } = useListMyMeetingsQuery(undefined, { pollingInterval: 60000 });
  const [openId, setOpenId] = useState<string | null>(null);

  const meetings = data?.data ?? [];

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Meetings' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 640, margin: '0 auto' }}>
        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0', textAlign: 'center' }}>Loading…</div>
        ) : meetings.length === 0 ? (
          <div style={{ ...card, padding: '24px 20px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            No meetings have been called.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {meetings.map(m => {
              const isOpen = openId === m.id;
              return (
                <div key={m.id} style={{ ...card, overflow: 'hidden' }}>
                  <button onClick={() => setOpenId(isOpen ? null : m.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px 16px',
                             background: 'none', border: 'none', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <StatusPill status={m.status} />
                      <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{MEETING_LABEL[m.meeting_type]}</span>
                      {!!m.open_votes && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                                       background: '#eff6ff', color: '#1d4ed8' }}>
                          {m.open_votes} to vote on
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 700, color: '#1e293b' }}>{m.title}</div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                      {fmtWhen(m.scheduled_at)}{m.venue && ` · ${m.venue}`}
                    </div>
                  </button>

                  {isOpen && <MeetingPanel meetingId={m.id} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
