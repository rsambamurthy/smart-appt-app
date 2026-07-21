import { baseApi } from './baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    requestOtp: builder.mutation<void, { phone: string }>({
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
  }),
});

export const { useRequestOtpMutation, useVerifyOtpMutation, useLogoutMutation, useGetMeQuery } = authApi;
