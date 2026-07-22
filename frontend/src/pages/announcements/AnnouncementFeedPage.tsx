import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import {
  useListAnnouncementsQuery, useMarkReadMutation,
  usePostAnnouncementMutation, useVoteMutation,
  useDeleteAnnouncementMutation,
} from '../../store/api/announcementsApi';

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = 'ALL' | 'URGENT' | 'EVENT' | 'MAINTENANCE' | 'MEETING' | 'GENERAL';

interface Poster { name: string; role: string }
interface PollOption { label: string; votes: number }
interface PollData { id: string; question: string; options: PollOption[] | null; closes_at: string; poll_type: string }
interface Announcement {
  id: string; title: string; body: string; category: string;
  is_urgent: boolean; published_at: string; expires_at?: string;
  posted_by: string;
  poster: Poster; attachment_keys: string[];
  poll?: PollData; read?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES: Category[] = ['ALL', 'URGENT', 'EVENT', 'MAINTENANCE', 'MEETING', 'GENERAL'];

const CAT_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  URGENT:      { bg: '#fee2e2', text: '#991b1b', border: '#C4572B' },
  EVENT:       { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  MAINTENANCE: { bg: '#fef9c3', text: '#854d0e', border: '#eab308' },
  MEETING:     { bg: '#e0e7ff', text: '#3730a3', border: '#6366f1' },
  GENERAL:     { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
};

const ROLES_CAN_POST   = ['MANAGER', 'COMMITTEE', 'SUPER_USER'];
const ROLES_CAN_DELETE = ['MANAGER', 'SUPER_USER'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ── Sub-components ────────────────────────────────────────────────────────────
const Avatar = ({ name, role }: { name: string; role: string }) => {
  const colors: Record<string, string> = {
    MANAGER: '#C4572B', COMMITTEE: '#6366f1', RESIDENT: '#0891b2', SUPER_USER: '#9C3F1E',
  };
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
      background: colors[role] ?? '#6b7280',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: '0.8rem',
    }}>{initials(name)}</div>
  );
};

const CategoryBadge = ({ cat }: { cat: string }) => {
  const c = CAT_COLOR[cat] ?? CAT_COLOR['GENERAL'];
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 6, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>{cat}</span>
  );
};

const PollBlock = ({ poll, onVote }: { poll: PollData; onVote: (answer: string) => void }) => {
  const [voted, setVoted] = useState<string | null>(null);
  const closed = new Date(poll.closes_at) < new Date();
  const options: { label: string; votes: number }[] = Array.isArray(poll.options) ? poll.options : [];
  const total = options.reduce((s, o) => s + (o.votes ?? 0), 0);

  const handleVote = (label: string) => {
    if (voted || closed) return;
    setVoted(label);
    onVote(label);
  };

  return (
    <div style={{ marginTop: '0.75rem', background: '#f9fafb', borderRadius: 8, padding: '0.75rem', border: '1px solid #e5e7eb' }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', color: '#374151' }}>
        📊 {poll.question}
      </div>
      {options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const isChosen = voted === opt.label;
        return (
          <div key={opt.label} onClick={() => handleVote(opt.label)}
            style={{ marginBottom: '0.4rem', cursor: closed || voted ? 'default' : 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 3 }}>
              <span style={{ fontWeight: isChosen ? 700 : 400 }}>{opt.label}</span>
              {(voted || closed) && <span style={{ color: '#6b7280' }}>{pct}%</span>}
            </div>
            {(voted || closed) && (
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: isChosen ? '#C4572B' : '#9ca3af', borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            )}
            {!voted && !closed && (
              <div style={{
                border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px',
                fontSize: '0.8rem', background: '#fff',
              }}>{opt.label}</div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.4rem' }}>
        {closed ? 'Poll closed' : `Closes ${fmtDate(poll.closes_at)}`} · {total} vote{total !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

// ── Compose Modal ─────────────────────────────────────────────────────────────
const ComposeModal = ({ onClose, onPost }: { onClose: () => void; onPost: () => void }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [isUrgent, setIsUrgent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [postAnnouncement] = usePostAnnouncementMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) { setError('Title and body are required.'); return; }
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('body', body);
      fd.append('category', category);
      fd.append('is_urgent', String(isUrgent));
      files.forEach((f) => fd.append('files', f));
      await postAnnouncement(fd).unwrap();
      onPost();
      onClose();
    } catch (err: unknown) {
      setError((err as { data?: { detail?: string } })?.data?.detail ?? 'Failed to post.');
      setPosting(false);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none',
  };
  const labelSt: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '0.8rem', marginBottom: 5, color: '#374151' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        margin: '1rem', padding: '1.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#9C3F1E' }}>New Announcement</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.875rem' }}>
            <label style={labelSt}>Title</label>
            <input style={input} placeholder="Announcement title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>

          <div style={{ marginBottom: '0.875rem' }}>
            <label style={labelSt}>Message</label>
            <textarea style={{ ...input, minHeight: 90, resize: 'vertical' } as React.CSSProperties}
              placeholder="Write your announcement..." value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Category</label>
              <select style={input} value={category} onChange={(e) => setCategory(e.target.value)}>
                {['GENERAL', 'EVENT', 'MAINTENANCE', 'MEETING', 'URGENT'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: isUrgent ? '#C4572B' : '#374151' }}>
                <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#C4572B' }} />
                Urgent
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelSt}>Attachments (optional)</label>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ border: '1px dashed #d1d5db', background: '#f9fafb', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', width: '100%' }}>
              {files.length > 0 ? `${files.length} file(s) selected` : '+ Attach files'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" disabled={posting}
              style={{ flex: 1, padding: '0.75rem', background: '#C4572B', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              {posting ? 'Posting...' : 'Post Announcement'}
            </button>
            <button type="button" onClick={onClose}
              style={{ padding: '0.75rem 1.25rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
const DeleteConfirmModal = ({ onConfirm, onCancel, deleting }: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
  }}>
    <div style={{
      background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 360,
      margin: '1rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>🗑️</div>
      <h3 style={{ margin: '0 0 0.5rem', textAlign: 'center', color: '#111827' }}>Delete Announcement?</h3>
      <p style={{ margin: '0 0 1.25rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
        This will permanently remove the announcement for everyone in the association.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={onCancel} disabled={deleting}
          style={{ flex: 1, padding: '0.65rem', background: '#f3f4f6', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={deleting}
          style={{ flex: 1, padding: '0.65rem', background: '#dc2626', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

// ── Feed Card ─────────────────────────────────────────────────────────────────
const FeedCard = ({ item, currentUserId, currentUserRole, onRead, onVote, onDelete }: {
  item: Announcement;
  currentUserId: string;
  currentUserRole: string;
  onRead: (id: string) => void;
  onVote: (pollId: string, answer: string) => void;
  onDelete: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isUnread = !item.read;
  const cat = CAT_COLOR[item.category] ?? CAT_COLOR['GENERAL'];

  // Show delete button if: user is the poster, or has a manager-level role
  const canDelete = item.posted_by === currentUserId || ROLES_CAN_DELETE.includes(currentUserRole);

  const handleClick = () => {
    setExpanded((v) => !v);
    if (isUnread) onRead(item.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    onDelete(item.id);
    // Modal stays open briefly while parent removes the card
  };

  return (
    <>
      <div onClick={handleClick} style={{
        background: '#fff', borderRadius: 12,
        border: `1px solid ${isUnread ? cat.border : '#e5e7eb'}`,
        borderLeft: `4px solid ${cat.border}`,
        padding: '1rem', cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}>
        {/* Header row — chevron lives here so it never overlaps action buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Avatar name={item.poster?.name ?? 'System'} role={item.poster?.role ?? 'MANAGER'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: isUnread ? 700 : 600, fontSize: '0.95rem', color: '#111827' }}>
                {item.title}
                {isUnread && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#C4572B', marginLeft: 7, verticalAlign: 'middle' }} />}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CategoryBadge cat={item.category} />
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', userSelect: 'none' }}>
                  {expanded ? '▲' : '▼'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
              {item.poster?.name ?? 'Committee'} · {fmtDate(item.published_at)}
            </div>
          </div>
        </div>

        {/* Body — always show first 2 lines, expand on click */}
        <div style={{
          marginTop: '0.625rem', fontSize: '0.875rem', color: '#374151',
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : 2,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
        }}>
          {item.body}
        </div>

        {/* Expanded section */}
        {expanded && (
          <div onClick={(e) => e.stopPropagation()}>
            {/* Attachments */}
            {item.attachment_keys?.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {item.attachment_keys.map((k) => (
                  <span key={k} style={{
                    background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6,
                    padding: '3px 10px', fontSize: '0.78rem', color: '#374151',
                  }}>📎 {k.split('/').pop()}</span>
                ))}
              </div>
            )}
            {/* Poll */}
            {item.poll && (
              <PollBlock poll={item.poll} onVote={(answer) => onVote(item.poll!.id, answer)} />
            )}
            {/* Expires */}
            {item.expires_at && (
              <div style={{ marginTop: '0.625rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                Expires {new Date(item.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
            {/* Delete button — shown only to poster or privileged roles */}
            {canDelete && (
              <div style={{ marginTop: '0.875rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleDeleteClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '0.4rem 0.9rem', background: '#fee2e2', color: '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: 8,
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  }}>
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {confirmDelete && (
        <DeleteConfirmModal
          deleting={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => { setConfirmDelete(false); setDeleting(false); }}
        />
      )}
    </>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnnouncementFeedPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const canPost = ROLES_CAN_POST.includes(user?.role ?? '');

  const [activeCategory, setActiveCategory] = useState<Category>('ALL');
  const [showCompose, setShowCompose] = useState(false);

  const queryParams = activeCategory === 'ALL' ? {} : { category: activeCategory };
  const { data, isFetching, refetch } = useListAnnouncementsQuery(queryParams);
  const [markRead] = useMarkReadMutation();
  const [vote] = useVoteMutation();
  const [deleteAnnouncement] = useDeleteAnnouncementMutation();

  // ── Real-time socket: join association room, listen for deletions ─────────
  useEffect(() => {
    if (!user?.association_id) return;

    const socket = io('/', {
      auth: { token: sessionStorage.getItem('access_token') },
      transports: ['websocket'],
    });

    socket.emit('join:association', user.association_id);

    socket.on('announcement:deleted', (_payload: { id: string }) => {
      // Refresh the list for ALL users — the deleted card will vanish
      refetch();
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.association_id]);

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id).unwrap();
      // Local refetch is immediate; socket will trigger refetch on all other clients
      refetch();
    } catch {
      // error is surfaced via RTK Query; card stays visible
    }
  };

  const items = (data?.data ?? []) as Announcement[];

  const tabStyle = (active: boolean, cat: Category): React.CSSProperties => {
    const c = CAT_COLOR[cat] ?? { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' };
    return {
      padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
      fontSize: '0.78rem', fontWeight: active ? 700 : 500,
      background: active ? (cat === 'ALL' ? '#C4572B' : c.bg) : '#f3f4f6',
      color: active ? (cat === 'ALL' ? '#fff' : c.text) : '#6b7280',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
    };
  };

  return (
    <Layout>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>Announcements</h1>
        {canPost && (
          <button onClick={() => setShowCompose(true)} style={{
            background: '#C4572B', color: '#fff', border: 'none',
            borderRadius: 10, padding: '0.5rem 1rem', fontWeight: 700,
            fontSize: '0.875rem', cursor: 'pointer',
          }}>+ New</button>
        )}
      </div>

      {/* Category filter tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: '1rem' }}>
        {CATEGORIES.map((cat) => (
          <button key={cat} style={tabStyle(activeCategory === cat, cat)} onClick={() => setActiveCategory(cat)}>
            {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isFetching ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af',
          background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📢</div>
          <div style={{ fontWeight: 600, color: '#374151' }}>No announcements</div>
          <div style={{ fontSize: '0.875rem', marginTop: 4 }}>
            {activeCategory === 'ALL' ? 'Nothing posted yet.' : `No ${activeCategory.toLowerCase()} announcements.`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((a) => (
            <FeedCard
              key={a.id}
              item={a}
              currentUserId={user?.id ?? ''}
              currentUserRole={user?.role ?? ''}
              onRead={(id) => markRead(id)}
              onVote={(pollId, answer) => vote({ id: pollId, answer })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onPost={() => refetch()}
        />
      )}
    </Layout>
  );
}
