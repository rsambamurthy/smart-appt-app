import { baseApi } from './baseApi';

export interface AskResponse {
  conversation_id: string;
  message_id:      string;
  answer:          string;
  /**
   * Present when the assistant wants to do something. The arguments are
   * deliberately absent — confirmation is by message id and the server reads
   * back what it stored, so the client cannot alter what gets executed.
   */
  proposed_action: { action: string; summary: string } | null;
  /** Which lookups produced the answer. Shown so a figure is attributable. */
  used_tools:      string[];
}

export interface AssistantMessage {
  id:              string;
  author:          'USER' | 'ASSISTANT';
  content:         string;
  created_at:      string;
  proposed_action: { action: string; summary: string } | null;
  action_status:   string | null;
}

export const assistantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    ask: builder.mutation<{ data: AskResponse }, {
      message: string;
      conversation_id?: string;
      /** 'voice' when the question was spoken, so the answer is shaped for the ear. */
      input_mode?: 'voice';
    }>({
      query: (body) => ({ url: '/assistant/ask', method: 'POST', body }),
    }),
    getAssistantConversation: builder.query<
      { data: { id: string; title: string | null; messages: AssistantMessage[] } },
      string
    >({
      query: (id) => `/assistant/conversations/${id}`,
      providesTags: ['AssistantConversation'],
    }),
    listAssistantConversations: builder.query<
      { data: Array<{ id: string; title: string | null; last_message_at: string }> },
      void
    >({
      query: () => '/assistant/conversations',
      providesTags: ['AssistantConversation'],
    }),
    confirmAssistantAction: builder.mutation<
      { data: { status: string; summary: string } }, string
    >({
      query: (messageId) => ({ url: `/assistant/messages/${messageId}/confirm`, method: 'POST' }),
      // Anything the assistant does lands on some other screen, and there is no
      // cheap way to know which. Invalidating broadly is the honest choice —
      // a stale dues figure after a payment claim is worse than a refetch.
      invalidatesTags: ['AssistantConversation', 'Ticket', 'Visitor', 'PaymentClaim', 'Bill', 'Statement'],
    }),
    cancelAssistantAction: builder.mutation<{ data: { status: string } }, string>({
      query: (messageId) => ({ url: `/assistant/messages/${messageId}/cancel`, method: 'POST' }),
      invalidatesTags: ['AssistantConversation'],
    }),
  }),
});

export const {
  useAskMutation,
  useGetAssistantConversationQuery,
  useListAssistantConversationsQuery,
  useConfirmAssistantActionMutation,
  useCancelAssistantActionMutation,
} = assistantApi;
