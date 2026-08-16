import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { InboxRow } from '../governance/InboxLayout';
import { useListChatChannelsQuery } from '../../store/api/chatApi';
import { NewChatPanel } from '../chat/ChatPage';
import { useChatSocket } from '../../hooks/useChatSocket';

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const unreadPill = {
  background: '#2563eb', color: '#fff', borderRadius: 99,
  fontSize: 11, fontWeight: 700, padding: '1px 7px', minWidth: 18, textAlign: 'center' as const,
};

// The web version keeps the socket alive per-conversation (it stays mounted
// while a channel is open in the side pane). On mobile the list and the
// thread are separate screens, so this page just needs the socket for the
// unread badges to update live while the list itself is on screen.
export default function MobileChatPage() {
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);
  const { data } = useListChatChannelsQuery();
  const [pickerOpen, setPickerOpen] = useState(false);
  useChatSocket(null);

  const channels = data?.data ?? [];

  return (
    <div style={{ minHeight: '100%', background: 'transparent' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Chat</div>
        <button onClick={() => setPickerOpen(true)} style={{
          width: '100%', padding: '10px', borderRadius: 8, border: '1px dashed #93c5fd',
          background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          + New chat
        </button>
      </div>

      {channels.length === 0 ? (
        <div style={{ padding: '2rem 1rem', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
          No conversations yet. Start one above.
        </div>
      ) : channels.map((c) => (
        <InboxRow
          key={c.id}
          selected={false}
          accent={c.unread_count > 0 ? '#2563eb' : undefined}
          title={c.name}
          meta={c.last_message
            ? (c.last_message.sender_id === user?.id ? `You: ${c.last_message.content}` : c.last_message.content)
            : 'No messages yet'}
          trailing={c.unread_count > 0
            ? <span style={unreadPill}>{c.unread_count}</span>
            : (c.last_message ? fmtDay(c.last_message_at) : undefined)}
          onClick={() => navigate(`/mobile/chat/${c.id}`)}
        />
      ))}

      {pickerOpen && (
        <NewChatPanel
          onClose={() => setPickerOpen(false)}
          onOpened={(id) => { setPickerOpen(false); navigate(`/mobile/chat/${id}`); }}
        />
      )}
    </div>
  );
}
