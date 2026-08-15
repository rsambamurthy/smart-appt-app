import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import type { RootState, AppDispatch } from '../store';
import { API_BASE } from '../store/api/baseApi';
import { chatApi, type ChatMessage } from '../store/api/chatApi';

// API_BASE is '/api/v1' on web (same-origin, proxied) but a full remote URL
// on the mobile build (VITE_API_URL, baked in at APK build time — see
// build-apk-prod.bat). A socket has to connect to the server's own origin,
// not '/api/v1' itself, so the suffix is stripped here. On web this reduces
// to an empty string, which socket.io-client treats the same as connecting
// to the page's own origin.
const SOCKET_BASE = API_BASE.replace(/\/api\/v1\/?$/, '') || undefined;

/**
 * One socket per mounted chat screen. Connects once the user is signed in,
 * joins whichever channel is currently open, and patches the message list
 * cache directly on every incoming message rather than re-fetching it —
 * the same reasoning as everywhere else in this app that avoids polling
 * when a push is available.
 */
export function useChatSocket(activeChannelId: string | null) {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((s: RootState) => s.auth.access_token);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_BASE, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('chat:message', (msg: ChatMessage & { channel_id: string }) => {
      dispatch(
        chatApi.util.updateQueryData('listChatMessages', { id: msg.channel_id }, (draft) => {
          // A brief reconnect can replay an event; do not double-insert.
          if (draft.data.some((m) => m.id === msg.id)) return;
          draft.data.unshift(msg);
        }),
      );
      // The channel list carries the last-message preview and unread count —
      // both changed by this message, for someone other than the sender.
      dispatch(chatApi.util.invalidateTags(['ChatChannel']));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeChannelId) return;
    socket.emit('join:chat:channel', activeChannelId);
    return () => { socket.emit('leave:chat:channel', activeChannelId); };
  }, [activeChannelId]);
}
