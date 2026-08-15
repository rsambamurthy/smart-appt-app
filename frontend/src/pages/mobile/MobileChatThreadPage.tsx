import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useListChatChannelsQuery } from '../../store/api/chatApi';
import { ChatThread } from '../chat/ChatPage';
import { useChatSocket } from '../../hooks/useChatSocket';

export default function MobileChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);
  // Channel metadata (name, member count, unread) comes from the list
  // query's cache — a second full fetch just to know the channel's name
  // would be wasteful, and the list is already loaded from the previous
  // screen in the normal navigation path.
  const { data } = useListChatChannelsQuery();
  const channel = data?.data.find((c) => c.id === id) ?? null;

  useChatSocket(id ?? null);

  if (!channel || !user) {
    return (
      <div style={{ padding: '2rem 1rem', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
        {channel === null ? 'Loading…' : 'This conversation is no longer available.'}
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => navigate('/mobile/chat')} style={{
        margin: '10px 0 0 12px', padding: '6px 10px', border: 'none', background: 'none',
        color: '#1d4ed8', fontWeight: 600, fontSize: 13, cursor: 'pointer',
      }}>
        ← Chats
      </button>
      <ChatThread
        channel={channel}
        myId={user.id}
        heightStyle={{ height: 'calc(100dvh - 150px)' }}
        onLeft={() => navigate('/mobile/chat')}
      />
    </div>
  );
}
