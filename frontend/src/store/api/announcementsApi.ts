import { baseApi } from './baseApi';

export const announcementsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listAnnouncements: builder.query<{ data: unknown[]; meta: object }, object>({ query: (params) => ({ url: '/announcements', params }), providesTags: ['Announcement'] }),
    getAnnouncement: builder.query<{ data: unknown }, string>({ query: (id) => `/announcements/${id}` }),
    postAnnouncement: builder.mutation<{ data: unknown }, FormData>({ query: (body) => ({ url: '/announcements', method: 'POST', body }), invalidatesTags: ['Announcement'] }),
    markRead: builder.mutation<void, string>({ query: (id) => ({ url: `/announcements/${id}/read`, method: 'POST' }), invalidatesTags: ['Announcement'] }),
    createPoll: builder.mutation<{ data: unknown }, object>({ query: (body) => ({ url: '/announcements/polls', method: 'POST', body }) }),
    vote: builder.mutation<void, { id: string; answer: string }>({ query: ({ id, answer }) => ({ url: `/announcements/polls/${id}/vote`, method: 'POST', body: { answer } }) }),
    getPollResults: builder.query<{ data: unknown }, string>({ query: (id) => `/announcements/polls/${id}/results` }),
    listDocuments: builder.query<{ data: unknown[] }, { category?: string }>({ query: (params) => ({ url: '/announcements/documents', params }), providesTags: ['Document'] }),
    getDocumentUrl: builder.query<{ data: { url: string } }, string>({ query: (id) => `/announcements/documents/${id}/download` }),
    uploadDocument: builder.mutation<{ data: unknown }, FormData>({ query: (body) => ({ url: '/announcements/documents', method: 'POST', body }), invalidatesTags: ['Document'] }),
    deactivateDocument: builder.mutation<{ data: unknown }, string>({ query: (id) => ({ url: `/announcements/documents/${id}`, method: 'DELETE' }), invalidatesTags: ['Document'] }),
    deleteAnnouncement: builder.mutation<{ data: { deleted: boolean; id: string } }, string>({ query: (id) => ({ url: `/announcements/${id}`, method: 'DELETE' }), invalidatesTags: ['Announcement'] }),
  }),
});

export const {
  useListAnnouncementsQuery, useGetAnnouncementQuery, usePostAnnouncementMutation,
  useMarkReadMutation, useCreatePollMutation, useVoteMutation, useGetPollResultsQuery,
  useListDocumentsQuery, useGetDocumentUrlQuery, useUploadDocumentMutation, useDeactivateDocumentMutation,
  useDeleteAnnouncementMutation,
} = announcementsApi;
