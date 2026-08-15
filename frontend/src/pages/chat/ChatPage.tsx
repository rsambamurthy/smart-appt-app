import { useState, useEffect, useRef, useMemo, CSSProperties } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import Layout from '../../components/organisms/Layout';
import PageSubHeader from '../../components/molecules/PageSubHeader';
import InboxLayout, { InboxRow } from '../governance/InboxLayout';
import {
  useListChatChannelsQuery, useListChatMessagesQuery, useSendChatMessageMutation,
  useMarkChatReadMutation, useGetChatDirectoryQuery, useGetOrCreateDirectChannelMutation,
  useCreateChatGroupMutation, useLeaveChatGroupMutation,
  type ChatChannelSummary, type ChatDirectoryUser,
} from '../../store/api/chatApi';
import { useChatSocket } from '../../hooks/useChatSocket';

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const bubble = (mine: boolean): CSSProperties => ({
  alignSelf: mine ? 'flex-end' : 'flex-start',
  maxWidth: '78%',
  background: mine ? '#1e293b' : '#f1f5f9',
  color: mine ? '#fff' : '#0f172a',
  padding: '9px 13px',
  borderRadius: 14,
  borderBottomRightRadius: mine ? 4 : 14,
  borderBottomLeftRadius: mine ? 14 : 4,
  fontSize: 14,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

const unreadPill: CSSProperties = {
  background: '#2563eb', color: '#fff', borderRadius: 99,
  fontSize: 11, fontWeight: 700, padding: '1px 7px', minWidth: 18, textAlign: 'center',
};

const field: CSSProperties = {
  padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
};

// ── New chat / new group picker ────────────────────────────────────────────

export function NewChatPanel({ onClose, onOpened }: { onClose: () => void; onOpened: (channelId: string) => void }) {
  const { data, isLoading } = useGetChatDirectoryQuery();
  const [getOrCreateDirect] = useGetOrCreateDirectChannelMutation();
  const [createGroup, { isLoading: creatingGroup }] = useCreateChatGroupMutation();
  const [search, setSearch] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');

  const people = (data?.data ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || (u.unit?.flat_number ?? '').toLowerCase().includes(q);
  });

  const openDirect = async (u: ChatDirectoryUser) => {
    const res = await getOrCreateDirect({ user_id: u.id }).unwrap();
    onOpened(res.data.id);
  };

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startGroup = async () => {
    if (!groupName.trim() || picked.size === 0) return;
    const res = await createGroup({ name: groupName.trim(), member_ids: Array.from(picked) }).unwrap();
    onOpened(res.data.id);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420,
        maxHeight: '78vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
            {groupMode ? 'New group' : 'New chat'}
          </div>
          <button onClick={() => setGroupMode((v) => !v)} style={{
            fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer',
          }}>
            {groupMode ? 'Just a person instead' : 'Make it a group'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8' }}>×</button>
        </div>

        {groupMode && (
          <div style={{ padding: '10px 16px 0' }}>
            <input style={field} placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
          </div>
        )}

        <div style={{ padding: '10px 16px' }}>
          <input style={field} placeholder="Search by name or flat" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ padding: '1.5rem', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Loading…</div>
          ) : people.length === 0 ? (
            <div style={{ padding: '1.5rem', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Nobody matches.</div>
          ) : people.map((u) => (
            <div key={u.id}
              onClick={() => groupMode ? toggle(u.id) : openDirect(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                cursor: 'pointer', borderBottom: '1px solid #f8fafc',
              }}>
              {groupMode && (
                <input type="checkbox" checked={picked.has(u.id)} onChange={() => toggle(u.id)} onClick={(e) => e.stopPropagation()} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                  {u.role.replace(/_/g, ' ')}{u.unit ? ` · Flat ${u.unit.flat_number}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {groupMode && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9' }}>
            <button onClick={startGroup} disabled={creatingGroup || !groupName.trim() || picked.size === 0}
              style={{
                width: '100%', padding: '9px', borderRadius: 8, border: 'none',
                background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: 'pointer', opacity: (!groupName.trim() || picked.size === 0) ? 0.5 : 1,
              }}>
              {creatingGroup ? 'Creating…' : `Create group (${picked.size} added)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Thread ───────────────────────────────────────────────────────────────────

export function ChatThread({
  channel, myId, heightStyle, onLeft,
}: {
  channel: ChatChannelSummary; myId: string;
  /** Desktop sits inside a fixed-height inbox pane; mobile fills the screen. */
  heightStyle?: CSSProperties;
  /** Mobile needs to navigate away once "Leave group" actually leaves. */
  onLeft?: () => void;
}) {
  const { data, isLoading } = useListChatMessagesQuery({ id: channel.id });
  const [sendMessage, { isLoading: sending }] = useSendChatMessageMutation();
  const [markRead] = useMarkChatReadMutation();
  const [leaveGroup] = useLeaveChatGroupMutation();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => [...(data?.data ?? [])].reverse(), [data]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (channel.unread_count > 0) markRead({ id: channel.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, channel.unread_count]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    try { await sendMessage({ id: channel.id, content }).unwrap(); }
    catch { setText(content); }
  };

  const doLeave = async () => {
    await leaveGroup({ id: channel.id }).unwrap();
    onLeft?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...(heightStyle ?? { height: '72vh' }) }}>
      <div style={{ padding: '11px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{channel.name}</div>
          {channel.type === 'GROUP' && (
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{channel.member_count} members</div>
          )}
        </div>
        {channel.type === 'GROUP' && (
          <button onClick={doLeave}
            style={{ fontSize: 12, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
            Leave group
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isLoading ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: '2rem' }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: '2rem' }}>
            Nothing here yet — say hello.
          </div>
        ) : messages.map((m) => {
          const mine = m.sender.id === myId;
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {channel.type === 'GROUP' && !mine && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2, marginLeft: 4 }}>{m.sender.name}</div>
              )}
              <div style={bubble(mine)}>
                {m.deleted ? <em style={{ opacity: 0.7 }}>This message was deleted</em> : m.content}
              </div>
              <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>{fmtTime(m.created_at)}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
        <input
          style={{ ...field, flex: 1 }}
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
        />
        <button type="submit" disabled={sending || !text.trim()} style={{
          padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1d4ed8',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          opacity: !text.trim() ? 0.5 : 1,
        }}>
          Send
        </button>
      </form>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data } = useListChatChannelsQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useChatSocket(selected);

  const channels = data?.data ?? [];
  const activeChannel = channels.find((c) => c.id === selected) ?? null;

  const toolbar = (
    <div style={{ padding: '9px 10px' }}>
      <button onClick={() => setPickerOpen(true)} style={{
        width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed #93c5fd',
        background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
      }}>
        + New chat
      </button>
    </div>
  );

  const list = channels.length === 0 ? (
    <div style={{ padding: '1.5rem 1rem', color: '#94a3b8', fontSize: 13 }}>
      No conversations yet. Start one above.
    </div>
  ) : channels.map((c) => (
    <InboxRow
      key={c.id}
      selected={selected === c.id}
      accent={c.unread_count > 0 ? '#2563eb' : undefined}
      title={c.name}
      meta={c.last_message ? (c.last_message.sender_id === user?.id ? `You: ${c.last_message.content}` : c.last_message.content) : 'No messages yet'}
      trailing={c.unread_count > 0
        ? <span style={unreadPill}>{c.unread_count}</span>
        : (c.last_message ? fmtDay(c.last_message_at) : undefined)}
      onClick={() => setSelected(c.id)}
    />
  ));

  return (
    <Layout>
      <PageSubHeader crumbs={[{ label: 'Chat' }]} />
      <div style={{ padding: '1rem 1.25rem 3rem' }}>
        <InboxLayout
          toolbar={toolbar}
          list={list}
          detail={activeChannel && user ? <ChatThread channel={activeChannel} myId={user.id} /> : null}
          placeholder="Select a conversation, or start a new one."
        />
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, maxWidth: 640, lineHeight: 1.6 }}>
          Chat is between residents, committee, treasurer and manager accounts only.
        </div>
      </div>
      {pickerOpen && (
        <NewChatPanel
          onClose={() => setPickerOpen(false)}
          onOpened={(id) => { setSelected(id); setPickerOpen(false); }}
        />
      )}
    </Layout>
  );
}
