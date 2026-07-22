import { baseApi } from './baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    requestOtp: builder.mutation<{ data: { wa_status?: object; dev_otp?: string } }, { phone: string }>({
      query: (body) => ({ url: '/auth/otp/request', method: 'POST', body }),
    }),
    verifyOtp: builder.mutation<{ data: { access_token: string; refresh_token: string; user: object } }, { phone: string; otp: string }>({
      query: (body) => ({ url: '/auth/otp/verify', method: 'POST', body }),
    }),
    refreshToken: builder.mutation<{ data: { access_token: string } }, { refresh_token: string }>({
      query: (body) => ({ url: '/auth/token/refresh', method: 'POST', body }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    getMe: builder.query<{ data: object }, void>({
      query: () => '/auth/me',
    }),
    // M-PIN
    getMpinStatus: builder.query<{ data: { has_mpin: boolean } }, { phone: string }>({
      query: ({ phone }) => `/auth/mpin/status?phone=${encodeURIComponent(phone)}`,
    }),
    verifyMpin: builder.mutation<{ data: { access_token: string; refresh_token: string; user: object } }, { phone: string; mpin: string }>({
      query: (body) => ({ url: '/auth/mpin/verify', method: 'POST', body }),
    }),
    setMpin: builder.mutation<void, { mpin: string }>({
      query: (body) => ({ url: '/auth/mpin/set', method: 'POST', body }),
    }),
    resetMpin: builder.mutation<void, { phone: string; otp: string; new_mpin: string }>({
      query: (body) => ({ url: '/auth/mpin/reset', method: 'POST', body }),
    }),
    changeMpin: builder.mutation<void, { current_mpin: string; new_mpin: string }>({
      query: (body) => ({ url: '/auth/mpin/change', method: 'POST', body }),
    }),
  }),
});

export const {
  useRequestOtpMutation,
  useVerifyOtpMutation,
  useLogoutMutation,
  useGetMeQuery,
  useGetMpinStatusQuery,
  useVerifyMpinMutation,
  useSetMpinMutation,
  useResetMpinMutation,
  useChangeMpinMutation,
} = authApi;
