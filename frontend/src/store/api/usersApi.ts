import { baseApi } from './baseApi';

export const usersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Users ────────────────────────────────────────────────────────────────
    listUsers: builder.query<{ data: unknown[]; meta: object }, object>({
      query: (params) => ({ url: '/users', params }),
      providesTags: ['User'],
    }),
    getUser: builder.query<{ data: unknown }, string>({
      query: (id) => `/users/${id}`,
      providesTags: ['User'],
    }),
    createUser: builder.mutation<{ data: unknown }, object>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User', 'Unit'],
    }),
    updateUser: builder.mutation<{ data: unknown }, { id: string; body: object }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['User', 'Unit'], // unit assignment change must refresh unit occupancy
    }),
    deactivateUser: builder.mutation<{ data: unknown }, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User', 'Unit'], // deactivation frees up the unit
    }),
    inviteUser: builder.mutation<{ data: unknown }, object>({
      query: (body) => ({ url: '/users/invites', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),

    // ── Units ────────────────────────────────────────────────────────────────
    listUnits: builder.query<{ data: unknown[] }, { association_id?: string } | void>({
      query: (params) => ({ url: '/users/units', params: params ?? {} }),
      providesTags: ['Unit'],
    }),
    createUnit: builder.mutation<{ data: unknown }, object>({
      query: (body) => ({ url: '/users/units', method: 'POST', body }),
      invalidatesTags: ['Unit'],
    }),
    updateUnit: builder.mutation<{ data: unknown }, { id: string; body: object; association_id?: string }>({
      query: ({ id, body, association_id }) => ({ url: `/users/units/${id}`, method: 'PATCH', body, params: association_id ? { association_id } : {} }),
      invalidatesTags: ['Unit'],
    }),
    deleteUnit: builder.mutation<{ data: unknown }, { id: string; association_id?: string }>({
      query: ({ id, association_id }) => ({ url: `/users/units/${id}`, method: 'DELETE', params: association_id ? { association_id } : {} }),
      invalidatesTags: ['Unit'],
    }),
    bulkImportUsers: builder.mutation<{ data: { created: number; skipped: number; errors: string[] } }, { records: object[] }>({
      query: (body) => ({ url: '/users/bulk-import', method: 'POST', body }),
      invalidatesTags: ['User', 'Unit'],
    }),
    bulkImportUnits: builder.mutation<{ data: { created: number; skipped: number; errors: string[] } }, { records: object[] }>({
      query: (body) => ({ url: '/users/units/bulk-import', method: 'POST', body }),
      invalidatesTags: ['Unit'],
    }),
  }),
});

export const {
  useListUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useInviteUserMutation,
  useListUnitsQuery,
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useDeleteUnitMutation,
  useBulkImportUsersMutation,
  useBulkImportUnitsMutation,
} = usersApi;
