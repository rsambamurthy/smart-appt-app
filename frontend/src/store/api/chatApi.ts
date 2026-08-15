import { baseApi } from './baseApi';

export type ChatChannelType = 'DIRECT' | 'GROUP';

export interface ChatDirectoryUser {
  id: string;
  name: string;
  role: string;
  unit: { flat_number: string; block: string | null } | null;
}

export interface ChatChannelSummary {
  id: string;
  type: ChatChannelType;
  /** For a DIRECT channel this is the other person's name, resolved server-side. */
  name: string;
  other_user: { id: string; name: string; role: string } | null;
  member_count: number;
  last_message: { content: string; sender_id: string; created_at: string } | null;
  last_message_at: string;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  sender: { id: string; name: string };
  /** Null when the message was deleted — `deleted` is what to render instead. */
  content: string | null;
  deleted: boolean;
  created_at: string;
}

export const chatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChatDirectory: builder.query<{ data: ChatDirectoryUser[] }, void>({
      query: () => '/chat/directory',
    }),

    listChatChannels: builder.query<{ data: ChatChannelSummary[] }, void>({
      query: () => '/chat/channels',
      providesTags: ['ChatChannel'],
    }),

    getOrCreateDirectChannel: builder.mutation<{ data: { id: string; created: boolean } }, { user_id: string }>({
      query: (body) => ({ url: '/chat/channels/direct', method: 'POST', body }),
      invalidatesTags: ['ChatChannel'],
    }),

    createChatGroup: builder.mutation<{ data: { id: string } }, { name: string; member_ids: string[] }>({
      query: (body) => ({ url: '/chat/channels/group', method: 'POST', body }),
      invalidatesTags: ['ChatChannel'],
    }),

    renameChatGroup: builder.mutation<{ data: { ok: true } }, { id: string; name: string }>({
      query: ({ id, name }) => ({ url: `/chat/channels/${id}`, method: 'PATCH', body: { name } }),
      invalidatesTags: ['ChatChannel'],
    }),

    addChatMember: builder.mutation<{ data: { ok: true } }, { id: string; user_id: string }>({
      query: ({ id, user_id }) => ({ url: `/chat/channels/${id}/members`, method: 'POST', body: { user_id } }),
      invalidatesTags: ['ChatChannel'],
    }),

    removeChatMember: builder.mutation<{ data: { ok: true } }, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/chat/channels/${id}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['ChatChannel'],
    }),

    leaveChatGroup: builder.mutation<{ data: { ok: true } }, { id: string }>({
      query: ({ id }) => ({ url: `/chat/channels/${id}/leave`, method: 'POST' }),
      invalidatesTags: ['ChatChannel'],
    }),

    listChatMessages: builder.query<{ data: ChatMessage[]; meta: { next_cursor: string | null } }, { id: string }>({
      query: ({ id }) => `/chat/channels/${id}/messages`,
      providesTags: (_r, _e, arg) => [{ type: 'ChatMessage', id: arg.id }],
    }),

    sendChatMessage: builder.mutation<{ data: ChatMessage }, { id: string; content: string }>({
      query: ({ id, content }) => ({ url: `/chat/channels/${id}/messages`, method: 'POST', body: { content } }),
      // No cache patch here — the message this call produces arrives back
      // over the socket like any other, so the thread only ever has one
      // source of truth for "what's in it".
    }),

    markChatRead: builder.mutation<{ data: { ok: true } }, { id: string }>({
      query: ({ id }) => ({ url: `/chat/channels/${id}/read`, method: 'POST' }),
      invalidatesTags: ['ChatChannel'],
    }),
  }),
});

export const {
  useGetChatDirectoryQuery,
  useListChatChannelsQuery,
  useGetOrCreateDirectChannelMutation,
  useCreateChatGroupMutation,
  useRenameChatGroupMutation,
  useAddChatMemberMutation,
  useRemoveChatMemberMutation,
  useLeaveChatGroupMutation,
  useListChatMessagesQuery,
  useSendChatMessageMutation,
  useMarkChatReadMutation,
} = chatApi;
