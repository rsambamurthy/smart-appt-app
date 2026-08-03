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
  /** True when this meeting counts members rather than flats. */
  counts_members: boolean;
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
  committee_id: string | null;
  committee: { id: string; name: string; is_managing: boolean } | null;
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
  /** Null for a committee meeting, where the register lists members. */
  unit_id: string | null;
  user_id: string | null;
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

export interface Committee {
  id: string;
  name: string;
  description: string | null;
  is_managing: boolean;
  member_count: number;
}

export interface CommitteeMemberRow {
  user_id: string;
  name: string;
  unit_id: string | null;
  flat_number: string | null;
  is_convenor: boolean;
  /** Why they are on it — set only for the derived managing committee. */
  via?: string;
}

export interface RegisterUnitRow {
  unit_id: string;
  flat_number: string;
  block: string | null;
  member_no: number | null;
  admitted_on: string | null;
  member_name: string | null;
  /** The member's account, when they have one. Null means they cannot act in-app. */
  member_user_id: string | null;
  joint_count: number;
  has_member: boolean;
}

export interface Holder {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  user_id: string | null;
  is_primary: boolean;
}

export interface Nominee {
  id: string;
  name: string;
  relationship: string | null;
  share_percent: string | null;
  recorded_on: string;
}

export interface Membership {
  id: string;
  member_no: number;
  admitted_on: string;
  ceased_on: string | null;
  cessation_reason: string | null;
  status: 'ACTIVE' | 'CEASED';
  share_percent: string | null;
  deed_reference: string | null;
  notes: string | null;
  preceded_by_id: string | null;
  holders: Holder[];
  nominees: Nominee[];
}

export interface HolderInput {
  name: string; phone?: string; email?: string; user_id?: string | null;
}

export type ElectionStatus =
  'DRAFT' | 'NOMINATIONS_OPEN' | 'NOMINATIONS_CLOSED'
  | 'VOTING_OPEN' | 'VOTING_CLOSED' | 'DECLARED' | 'CANCELLED';

export type NominationStatus = 'PROPOSED' | 'SECONDED' | 'ACCEPTED' | 'WITHDRAWN' | 'REJECTED';

export interface Candidate {
  id: string;
  status: NominationStatus;
  statement: string | null;
  proposed_by_unit_id: string | null;
  seconded_by_unit_id: string | null;
  seconded_at: string | null;
  accepted_at: string | null;
  user: { id: string; name: string };
  unit: { id: string; flat_number: string; block: string | null };
  votes?: number;
}

export interface Election {
  id: string;
  title: string;
  seats: number;
  status: ElectionStatus;
  term_starts_on: string;
  term_ends_on: string;
  nominations_close_at: string | null;
  voting_closes_at: string | null;
  declared_at: string | null;
  committee: { id: string; name: string; is_managing: boolean };
  _count?: { candidates: number; roll: number };
}

export interface ElectionDetail extends Election {
  candidates: Candidate[];
  turnout: { eligible: number; voted: number };
  my_vote_cast: boolean;
  results: {
    standing: Candidate[];
    elected: string[];
    tied: boolean;
    tie_at_votes: number | null;
  } | null;
}

export const governanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ── Elections ─────────────────────────────────────────────────────────────
    listElections: builder.query<{ data: Election[] }, void>({
      query: () => '/governance/elections',
      providesTags: ['Election'],
    }),
    getElection: builder.query<{ data: ElectionDetail }, string>({
      query: (id) => `/governance/elections/${id}`,
      providesTags: ['Election'],
    }),
    createElection: builder.mutation<{ data: Election }, {
      committee_id: string; title: string; seats: number;
      term_starts_on: string; term_ends_on: string;
    }>({
      query: (body) => ({ url: '/governance/elections', method: 'POST', body }),
      invalidatesTags: ['Election'],
    }),
    setElectionStatus: builder.mutation<{ data: Election }, { id: string; status: ElectionStatus }>({
      query: ({ id, status }) => ({ url: `/governance/elections/${id}/status`, method: 'POST', body: { status } }),
      invalidatesTags: ['Election'],
    }),
    declareElection: builder.mutation<{ data: { roster_updated: boolean; tied: boolean } }, string>({
      query: (id) => ({ url: `/governance/elections/${id}/declare`, method: 'POST' }),
      invalidatesTags: ['Election', 'Committee'],
    }),
    proposeCandidate: builder.mutation<{ data: Candidate }, { id: string; user_id: string }>({
      query: ({ id, user_id }) => ({ url: `/governance/elections/${id}/nominations`, method: 'POST', body: { user_id } }),
      invalidatesTags: ['Election'],
    }),
    secondNomination: builder.mutation<{ data: Candidate }, string>({
      query: (candidateId) => ({ url: `/governance/nominations/${candidateId}/second`, method: 'POST' }),
      invalidatesTags: ['Election'],
    }),
    acceptNomination: builder.mutation<{ data: Candidate }, { candidateId: string; statement?: string }>({
      query: ({ candidateId, statement }) => ({
        url: `/governance/nominations/${candidateId}/accept`, method: 'POST', body: { statement },
      }),
      invalidatesTags: ['Election'],
    }),
    withdrawNomination: builder.mutation<{ data: Candidate }, { candidateId: string; as_organiser?: boolean }>({
      query: ({ candidateId, as_organiser }) => ({
        url: `/governance/nominations/${candidateId}/withdraw`, method: 'POST', body: { as_organiser },
      }),
      invalidatesTags: ['Election'],
    }),
    castBallot: builder.mutation<{ data: { cast: boolean } }, { id: string; candidate_ids: string[] }>({
      query: ({ id, candidate_ids }) => ({
        url: `/governance/elections/${id}/ballot`, method: 'POST', body: { candidate_ids },
      }),
      invalidatesTags: ['Election'],
    }),

    // ── Register of members ───────────────────────────────────────────────────
    listRegister: builder.query<
      { data: RegisterUnitRow[]; gaps: number; total: number },
      { q?: string; gaps?: boolean } | void
    >({
      query: (args) => ({ url: '/governance/register', params: {
        q: args?.q || undefined, gaps: args?.gaps ? 'true' : undefined,
      } }),
      providesTags: ['Membership'],
    }),
    getUnitRegister: builder.query<{ data: {
      unit: { id: string; flat_number: string; block: string | null; area_sqft: string | null };
      current: Membership | null;
      history: Membership[];
    } }, string>({
      query: (unitId) => `/governance/register/units/${unitId}`,
      providesTags: ['Membership'],
    }),
    admitMember: builder.mutation<{ data: Membership }, {
      unitId: string; admitted_on: string; holders: HolderInput[];
      primary_index?: number; share_percent?: number | null;
      deed_reference?: string | null; notes?: string | null;
    }>({
      query: ({ unitId, ...body }) => ({
        url: `/governance/register/units/${unitId}`, method: 'POST', body,
      }),
      invalidatesTags: ['Membership'],
    }),
    transferMembership: builder.mutation<{ data: Membership }, {
      unitId: string; transferred_on: string; holders: HolderInput[];
      primary_index?: number; cessation_reason?: string;
      share_percent?: number | null; deed_reference?: string | null;
    }>({
      query: ({ unitId, ...body }) => ({
        url: `/governance/register/units/${unitId}/transfer`, method: 'POST', body,
      }),
      invalidatesTags: ['Membership'],
    }),
    addHolder: builder.mutation<{ data: Membership }, { membershipId: string } & HolderInput>({
      query: ({ membershipId, ...body }) => ({
        url: `/governance/register/${membershipId}/holders`, method: 'POST', body,
      }),
      invalidatesTags: ['Membership'],
    }),
    setPrimaryHolder: builder.mutation<{ data: Membership }, { membershipId: string; holderId: string }>({
      query: ({ membershipId, holderId }) => ({
        url: `/governance/register/${membershipId}/holders/${holderId}/primary`, method: 'POST',
      }),
      invalidatesTags: ['Membership'],
    }),
    removeHolder: builder.mutation<{ data: Membership }, { membershipId: string; holderId: string }>({
      query: ({ membershipId, holderId }) => ({
        url: `/governance/register/${membershipId}/holders/${holderId}`, method: 'DELETE',
      }),
      invalidatesTags: ['Membership'],
    }),
    addNominee: builder.mutation<{ data: Membership }, {
      membershipId: string; name: string; relationship?: string; share_percent?: number | null;
    }>({
      query: ({ membershipId, ...body }) => ({
        url: `/governance/register/${membershipId}/nominees`, method: 'POST', body,
      }),
      invalidatesTags: ['Membership'],
    }),
    removeNominee: builder.mutation<{ data: Membership }, { membershipId: string; nomineeId: string }>({
      query: ({ membershipId, nomineeId }) => ({
        url: `/governance/register/${membershipId}/nominees/${nomineeId}`, method: 'DELETE',
      }),
      invalidatesTags: ['Membership'],
    }),

    // ── Committees ────────────────────────────────────────────────────────────
    listCommittees: builder.query<{ data: Committee[] }, void>({
      query: () => '/governance/committees',
      providesTags: ['Committee'],
    }),
    listCommitteeMembers: builder.query<{ data: CommitteeMemberRow[] }, string>({
      query: (id) => `/governance/committees/${id}/members`,
      providesTags: ['Committee'],
    }),
    createCommittee: builder.mutation<{ data: Committee }, { name: string; description?: string }>({
      query: (body) => ({ url: '/governance/committees', method: 'POST', body }),
      invalidatesTags: ['Committee'],
    }),
    updateCommittee: builder.mutation<{ data: Committee }, { id: string; name?: string; description?: string; is_active?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/governance/committees/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Committee'],
    }),
    addCommitteeMember: builder.mutation<{ data: unknown }, { id: string; user_id: string; is_convenor?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/governance/committees/${id}/members`, method: 'POST', body }),
      invalidatesTags: ['Committee'],
    }),
    removeCommitteeMember: builder.mutation<{ data: unknown }, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/governance/committees/${id}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Committee'],
    }),

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
      committee_id?: string | null;
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
    markAttendance: builder.mutation<{ data: Attendance }, {
      id: string; unit_id?: string | null; user_id?: string | null; attended: boolean;
    }>({
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
  useListElectionsQuery, useGetElectionQuery, useCreateElectionMutation,
  useSetElectionStatusMutation, useDeclareElectionMutation,
  useProposeCandidateMutation, useSecondNominationMutation,
  useAcceptNominationMutation, useWithdrawNominationMutation,
  useCastBallotMutation,
  useListRegisterQuery, useGetUnitRegisterQuery,
  useAdmitMemberMutation, useTransferMembershipMutation,
  useAddHolderMutation, useSetPrimaryHolderMutation, useRemoveHolderMutation,
  useAddNomineeMutation, useRemoveNomineeMutation,
  useListCommitteesQuery, useListCommitteeMembersQuery,
  useCreateCommitteeMutation, useUpdateCommitteeMutation,
  useAddCommitteeMemberMutation, useRemoveCommitteeMemberMutation,
  useGetGovernanceConfigQuery, useUpdateGovernanceConfigMutation,
  useListMeetingsQuery, useListMyMeetingsQuery, useGetMeetingQuery,
  useCreateMeetingMutation, useUpdateMeetingMutation,
  useIssueNoticeMutation, useSetMeetingStatusMutation,
  useAddAgendaItemMutation, useDeleteAgendaItemMutation,
  useRsvpMeetingMutation, useGetRegisterQuery, useMarkAttendanceMutation,
  useOpenVotingMutation, useCloseVotingMutation, useCastVoteMutation,
  useSaveMinutesMutation,
} = governanceApi;
