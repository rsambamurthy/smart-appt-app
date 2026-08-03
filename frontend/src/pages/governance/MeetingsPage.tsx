import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import {
  useListMeetingsQuery, useCreateMeetingMutation, useListCommitteesQuery,
  MeetingType, MeetingStatus,
} from '../../store/api/governanceApi';
import { useIsWide } from '../../hooks/useIsWide';
import InboxLayout, { InboxRow } from './InboxLayout';
import { MeetingDetail } from './MeetingDetailPage';
import { card, btn, field, label, MEETING_LABEL } from './meetingUi';

// A row's left accent, by state. Only things needing attention get a colour;
// everything finished stays neutral and dimmed, like read mail.
const ACCENT: Partial<Record<MeetingStatus, string>> = {
  DRAFT:         '#cbd5e1',
  NOTICE_ISSUED: '#2563eb',
  IN_PROGRESS:   '#15803d',
  CANCELLED:     '#fecaca',
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

type Filter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'DONE';

export default function MeetingsPage() {
  const navigate = useNavigate();
  const wide = useIsWide();
  const { data, isLoading } = useListMeetingsQuery();
  const { data: committeeData } = useListCommitteesQuery();
  const [create, { isLoading: creating }] = useCreateMeetingMutation();

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<Filter>('ALL');

  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType]   = useState<MeetingType>('AGM');
  const [when, setWhen]   = useState('');
  const [venue, setVenue] = useState('');
  const [committee, setCommittee] = useState('');
  const [error, setError] = useState<string | null>(null);

  const meetings   = useMemo(() => data?.data ?? [], [data]);
  const committees = committeeData?.data ?? [];

  const counts = useMemo(() => ({
    ALL:    meetings.length,
    ACTIVE: meetings.filter(m => m.status === 'NOTICE_ISSUED' || m.status === 'IN_PROGRESS').length,
    DRAFT:  meetings.filter(m => m.status === 'DRAFT').length,
    DONE:   meetings.filter(m => m.status === 'CONCLUDED' || m.status === 'CANCELLED').length,
  }), [meetings]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter(m => {
      if (q && !m.title.toLowerCase().includes(q)
            && !(m.committee?.name ?? '').toLowerCase().includes(q)) return false;
      if (filter === 'ACTIVE') return m.status === 'NOTICE_ISSUED' || m.status === 'IN_PROGRESS';
      if (filter === 'DRAFT')  return m.status === 'DRAFT';
      if (filter === 'DONE')   return m.status === 'CONCLUDED' || m.status === 'CANCELLED';
      return true;
    });
  }, [meetings, search, filter]);

  const submit = async () => {
    setError(null);
    const at = new Date(when);
    if (!title.trim())              return setError('Give the meeting a title.');
    if (Number.isNaN(at.getTime())) return setError('Set the date and time.');
    if (type === 'COMMITTEE' && !committee) return setError('Choose which committee is meeting.');

    try {
      const res = await create({
        title: title.trim(), meeting_type: type,
        scheduled_at: at.toISOString(), venue: venue.trim() || undefined,
        committee_id: type === 'COMMITTEE' ? committee : null,
      }).unwrap();
      setOpen(false); setTitle(''); setWhen(''); setVenue(''); setCommittee('');
      // On a wide screen the new meeting opens in the pane; on a narrow one it
      // navigates, because there is no pane to open it in.
      if (wide) setSelected(res.data.id);
      else navigate(`/governance/meetings/${res.data.id}`);
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string; message?: string } };
      setError(err?.data?.detail ?? err?.data?.message ?? 'Could not create the meeting.');
    }
  };

  const toolbar = (
    <div style={{ padding: '9px 10px' }}>
      <input
        style={{ ...field, fontSize: 13, padding: '7px 9px', marginBottom: 8 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search meetings"
        autoComplete="off"
      />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {([['ALL', 'All'], ['ACTIVE', 'Open'], ['DRAFT', 'Drafts'], ['DONE', 'Done']] as const)
          .map(([id, text]) => (
            <button key={id} onClick={() => setFilter(id)}
              style={{
                padding: '3px 9px', borderRadius: 99, cursor: 'pointer', fontSize: 11.5,
                border: 'none',
                fontWeight: filter === id ? 700 : 500,
                background: filter === id ? '#eff6ff' : 'transparent',
                color:      filter === id ? '#1d4ed8' : '#64748b',
              }}>
              {text} {counts[id]}
            </button>
          ))}
      </div>
    </div>
  );

  const list = isLoading ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
  ) : shown.length === 0 ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>
      {meetings.length === 0 ? 'No meetings yet.' : 'Nothing matches.'}
    </div>
  ) : (
    <>
      {shown.map(m => {
        const done = m.status === 'CONCLUDED' || m.status === 'CANCELLED';
        return (
          <InboxRow
            key={m.id}
            selected={selected === m.id}
            accent={ACCENT[m.status]}
            muted={done}
            title={m.title}
            trailing={shortDate(m.scheduled_at)}
            meta={<>
              {m.committee ? m.committee.name : MEETING_LABEL[m.meeting_type]}
              {' · '}{m.status.toLowerCase().replace('_', ' ')}
            </>}
            onClick={() => wide
              ? setSelected(m.id)
              : navigate(`/governance/meetings/${m.id}`)}
          />
        );
      })}
    </>
  );

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Governance' }, { label: 'Meetings' }]} />

      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        {!open ? (
          <button onClick={() => setOpen(true)}
            style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', marginBottom: 14 }}>
            Call a meeting
          </button>
        ) : (
          <div style={{ ...card, padding: '16px 18px', marginBottom: 14, maxWidth: 700 }}>
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
          </div>
        )}

        <InboxLayout
          toolbar={toolbar}
          list={list}
          detail={selected ? <MeetingDetail id={selected} /> : null}
          placeholder="Select a meeting to see its agenda, quorum and minutes."
        />
      </div>
    </Layout>
  );
}
