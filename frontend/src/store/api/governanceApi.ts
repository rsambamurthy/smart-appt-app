import { baseApi } from './baseApi';

export type MeetingType   = 'AGM' | 'EGM' | 'COMMITTEE';
export type MeetingStatus = 'DRAFT' | 'NOTICE_ISSUED' | 'IN_PROGRESS' | 'CONCLUDED' | 'CANCELLED';
export type RsvpStatus    = 'YES' | 'NO' | 'MAYBE';
export type VoteChoice    = 'FOR' | 'AGAINST' | 'ABSTAIN';
export type VotingStatus  = 'NOT_OPEN' | 'OPEN' | 'CLOSED';
export type Outcome       = 'CARRIED' | 'DEFEATED' | 'WITHDRAWN';

export interface Tally { for: number; against: number; abstain: number; total: number }

export interface AgendaItem {
  id: string;
  seq: number;
  title: string;
  description: string | null;
  is_resolution: boolean;
  is_secret: boolean;
  voting_status: VotingStatus;
  pass_threshold_percent: string;
  outcome: Outcome | null;
  voting_opened_at: string | null;
  voting_closed_at: string | null;
  tally: Tally;
  my_vote: VoteChoice | null;
}

export interface Attendance {
  eligible_units: number;
  present: number;
  rsvp_yes: number;
  quorum_percent: number | null;
  quorum_required: number | null;
  quorum_met: boolean | null;
}

export interface Meeting {
  id: string;
  title: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  scheduled_at: string;
  venue: string | null;
  online_link: string | null;
  notice_body: string | null;
  notice_issued_at: string | null;
  quorum_percent: string | null;
  eligible_units: number | null;
  concluded_at: string | null;
  minutes_body: string | null;
  minutes_published_at: string | null;
  _count?: { agenda_items: number; attendees: number };
  my_rsvp?: RsvpStatus | null;
  my_attended?: boolean;
  open_votes?: number;
}

export interface MeetingDetail extends Meeting {
  attendance: Attendance;
  agenda_items: AgendaItem[];
  my_rsvp: RsvpStatus | null;
  my_attended: boolean;
}

export interface RegisterRow {
  unit_id: string;
  flat_number: string;
  block: string | null;
  rsvp: RsvpStatus | null;
  attended: boolean;
  answered_by: string | null;
}

export interface GovernanceConfig {
  notice_days: number;
  quorum_percent: string;
  adjourned_quorum_percent: string | null;
  voting_window_hours: number;
}

export const governanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getGovernanceConfig: builder.query<{ data: GovernanceConfig }, void>({
      query: () => '/governance/config',
      providesTags: ['Meeting'],
    }),
    updateGovernanceConfig: builder.mutation<{ data: GovernanceConfig }, Partial<GovernanceConfig>>({
      query: (body) => ({ url: '/governance/config', method: 'PATCH', body }),
      invalidatesTags: ['Meeting'],
    }),

    listMeetings: builder.query<{ data: Meeting[] }, { status?: string; upcoming?: boolean } | void>({
      query: (args) => ({ url: '/governance/meetings', params: args ?? undefined }),
      providesTags: ['Meeting'],
    }),
    // What a resident sees: anything past draft, with their own flat's standing.
    listMyMeetings: builder.query<{ data: Meeting[] }, void>({
      query: () => '/governance/meetings/my',
      providesTags: ['Meeting'],
    }),
    getMeeting: builder.query<{ data: MeetingDetail }, string>({
      query: (id) => `/governance/meetings/${id}`,
      providesTags: ['Meeting'],
    }),

    createMeeting: builder.mutation<{ data: Meeting }, {
      title: string; meeting_type: MeetingType; scheduled_at: string;
      venue?: string; online_link?: string; notice_body?: string;
    }>({
      query: (body) => ({ url: '/governance/meetings', method: 'POST', body }),
      invalidatesTags: ['Meeting'],
    }),
    updateMeeting: builder.mutation<{ data: Meeting }, { id: string } & Partial<Meeting>>({
      query: ({ id, ...body }) => ({ url: `/governance/meetings/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Meeting'],
    }),
    issueNotice: builder.mutation<{ data: Meeting & { short_notice: boolean; clear_days: number } }, string>({
      query: (id) => ({ url: `/governance/meetings/${id}/notice`, method: 'POST' }),
      invalidatesTags: ['Meeting'],
    }),
    setMeetingStatus: builder.mutation<{ data: Meeting }, { id: string; status: MeetingStatus }>({
      query: ({ id, status }) => ({ url: `/governance/meetings/${id}/status`, method: 'POST', body: { status } }),
      invalidatesTags: ['Meeting'],
    }),

    addAgendaItem: builder.mutation<{ data: AgendaItem }, {
      meetingId: string; title: string; description?: string;
      is_resolution?: boolean; is_secret?: boolean; pass_threshold_percent?: number;
    }>({
      query: ({ meetingId, ...body }) => ({ url: `/governance/meetings/${meetingId}/agenda`, method: 'POST', body }),
      invalidatesTags: ['Meeting'],
    }),
    deleteAgendaItem: builder.mutation<{ data: unknown }, string>({
      query: (itemId) => ({ url: `/governance/agenda/${itemId}`, method: 'DELETE' }),
      invalidatesTags: ['Meeting'],
    }),

    rsvpMeeting: builder.mutation<{ data: unknown }, { id: string; status: RsvpStatus }>({
      query: ({ id, status }) => ({ url: `/governance/meetings/${id}/rsvp`, method: 'POST', body: { status } }),
      invalidatesTags: ['Meeting'],
    }),
    getRegister: builder.query<{ data: RegisterRow[] }, string>({
      query: (id) => `/governance/meetings/${id}/register`,
      providesTags: ['Meeting'],
    }),
    markAttendance: builder.mutation<{ data: Attendance }, { id: string; unit_id: string; attended: boolean }>({
      query: ({ id, ...body }) => ({ url: `/governance/meetings/${id}/attendance`, method: 'POST', body }),
      invalidatesTags: ['Meeting'],
    }),

    openVoting: builder.mutation<{ data: unknown }, string>({
      query: (itemId) => ({ url: `/governance/agenda/${itemId}/open`, method: 'POST' }),
      invalidatesTags: ['Meeting'],
    }),
    closeVoting: builder.mutation<{ data: { outcome: Outcome; tally: Tally; share: number } }, string>({
      query: (itemId) => ({ url: `/governance/agenda/${itemId}/close`, method: 'POST' }),
      invalidatesTags: ['Meeting'],
    }),
    castVote: builder.mutation<{ data: unknown }, { itemId: string; choice: VoteChoice }>({
      query: ({ itemId, choice }) => ({ url: `/governance/agenda/${itemId}/vote`, method: 'POST', body: { choice } }),
      invalidatesTags: ['Meeting'],
    }),

    saveMinutes: builder.mutation<{ data: Meeting }, { id: string; body: string; publish?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/governance/meetings/${id}/minutes`, method: 'PUT', body }),
      invalidatesTags: ['Meeting'],
    }),
  }),
});

export const {
  useGetGovernanceConfigQuery, useUpdateGovernanceConfigMutation,
  useListMeetingsQuery, useListMyMeetingsQuery, useGetMeetingQuery,
  useCreateMeetingMutation, useUpdateMeetingMutation,
  useIssueNoticeMutation, useSetMeetingStatusMutation,
  useAddAgendaItemMutation, useDeleteAgendaItemMutation,
  useRsvpMeetingMutation, useGetRegisterQuery, useMarkAttendanceMutation,
  useOpenVotingMutation, useCloseVotingMutation, useCastVoteMutation,
  useSaveMinutesMutation,
} = governanceApi;
