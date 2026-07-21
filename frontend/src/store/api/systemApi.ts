import { baseApi } from './baseApi';

export type MenuConfig = Record<string, Record<string, boolean>>;

export const systemApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMenuConfig: builder.query<{ data: MenuConfig }, void>({
      query: () => '/system/menu-config',
      providesTags: ['MenuConfig'],
    }),
    saveMenuConfig: builder.mutation<{ data: MenuConfig }, Array<{ group_id: string; role: string; enabled: boolean }>>({
      query: (body) => ({ url: '/system/menu-config', method: 'PUT', body }),
      invalidatesTags: ['MenuConfig'],
    }),
  }),
});

export const { useGetMenuConfigQuery, useSaveMenuConfigMutation } = systemApi;
