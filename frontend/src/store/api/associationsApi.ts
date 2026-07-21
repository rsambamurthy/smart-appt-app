import { baseApi } from './baseApi';

export const associationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    registerAssociation: builder.mutation<{ data: unknown }, object>({
      query: (body) => ({ url: '/associations/register', method: 'POST', body }),
    }),
    listAssociations: builder.query<{ data: unknown[] }, void>({
      query: () => '/associations',
      providesTags: ['Association'],
    }),
    getAssociation: builder.query<{ data: unknown }, string>({
      query: (id) => `/associations/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Association' as const, id }],
    }),
    updateAssociation: builder.mutation<{ data: unknown }, { id: string; body: object }>({
      query: ({ id, body }) => ({ url: `/associations/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Association'],
    }),
    deleteAssociation: builder.mutation<{ data: unknown }, string>({
      query: (id) => ({ url: `/associations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Association'],
    }),
    hardDeleteAssociation: builder.mutation<{ data: unknown }, string>({
      query: (id) => ({ url: `/associations/${id}/hard`, method: 'DELETE' }),
      invalidatesTags: ['Association'],
    }),
  }),
});

export const {
  useRegisterAssociationMutation,
  useListAssociationsQuery,
  useGetAssociationQuery,
  useUpdateAssociationMutation,
  useDeleteAssociationMutation,
  useHardDeleteAssociationMutation,
} = associationsApi;
