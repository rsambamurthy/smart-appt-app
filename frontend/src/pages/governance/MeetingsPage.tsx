import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListMeetingsQuery, useCreateMeetingMutation, useListCommitteesQuery, MeetingType,
} from '../../store/api/governanceApi';
import { card, btn, field, label, StatusPill, MEETING_LABEL, fmtWhen } from './meetingUi';

export default function MeetingsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useListMeetingsQuery();
  const { data: committeeData } = useListCommitteesQuery();
  const [create, { isLoading: creating }] = useCreateMeetingMutation();

  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType]   = useState<MeetingType>('AGM');
  const [when, setWhen]   = useState('');
  const [venue, setVenue] = useState('');
  const [committee, setCommittee] = useState('');
  const [error, setError] = useState<string | null>(null);

  const meetings   = data?.data ?? [];
  const committees = committeeData?.data ?? [];

  const submit = async () => {
    setError(null);
    const at = new Date(when);
    if (!title.trim())            return setError('Give the meeting a title.');
    if (Number.isNaN(at.getTime())) return setError('Set the date and time.');
    if (type === 'COMMITTEE' && !committee) return setError('Choose which committee is meeting.');

    try {
      const res = await create({
        title: title.trim(), meeting_type: type,
        scheduled_at: at.toISOString(), venue: venue.trim() || undefined,
        committee_id: type === 'COMMITTEE' ? committee : null,
      }).unwrap();
      navigate(`/governance/meetings/${res.data.id}`);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; message?: string } };
      setError(err?.data?.detail ?? err?.data?.message ?? 'Could not create the meeting.');
    }
  };

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Governance' }, { label: 'Meetings' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem', maxWidth: 860 }}>

        {!open ? (
          <button onClick={() => setOpen(true)}
            style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', marginBottom: 16 }}>
            Call a meeting
          </button>
        ) : (
          <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
              New meeting
            </div>

            {error && (
              <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13,
                            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={label}>Title</label>
                <input style={field} value={title} onChange={e => setTitle(e.target.value)}
                       placeholder="Annual general meeting 2026" />
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={label}>Type</label>
                  <select style={field} value={type} onChange={e => setType(e.target.value as MeetingType)}>
                    <option value="AGM">Annual general meeting</option>
                    <option value="EGM">Extraordinary general meeting</option>
                    <option value="COMMITTEE">Committee meeting</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={label}>Date and time</label>
                  <input style={field} type="datetime-local" value={when}
                         onChange={e => setWhen(e.target.value)} />
                </div>
              </div>

              {type === 'COMMITTEE' && (
                <div>
                  <label style={label}>Which committee</label>
                  <select style={field} value={committee} onChange={e => setCommittee(e.target.value)}>
                    <option value="">Choose…</option>
                    {committees.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.member_count} {c.member_count === 1 ? 'member' : 'members'}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                    Quorum and voting will count this committee's members, not flats.
                  </div>
                </div>
              )}

              <div>
                <label style={label}>Venue</label>
                <input style={field} value={venue} onChange={e => setVenue(e.target.value)}
                       placeholder="Clubhouse" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={submit} disabled={creating}
                style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
                {creating ? 'Creating…' : 'Create as draft'}
              </button>
              <button onClick={() => { setOpen(false); setError(null); }} style={btn}>Cancel</button>
            </div>

            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
              It stays a draft, invisible to residents, until you add the agenda
              and issue the notice.
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
        ) : meetings.length === 0 ? (
          <div style={{ ...card, padding: '26px 22px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
            No meetings yet. Call your first one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meetings.map(m => (
              <button key={m.id} onClick={() => navigate(`/governance/meetings/${m.id}`)}
                style={{ ...card, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <StatusPill status={m.status} />
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                    {m.committee ? m.committee.name : MEETING_LABEL[m.meeting_type]}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{m.title}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                  {fmtWhen(m.scheduled_at)}
                  {m.venue && ` · ${m.venue}`}
                  {m._count && ` · ${m._count.agenda_items} agenda items`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
