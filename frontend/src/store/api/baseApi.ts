import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';

// Web: uses Vite proxy → relative /api/v1
// Mobile (Capacitor): uses VITE_API_URL=https://your-ngrok-url.ngrok.io/api/v1
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      // Bypass ngrok browser warning page for mobile (Capacitor WebView)
      headers.set('ngrok-skip-browser-warning', 'true');
      return headers;
    },
  }),
  tagTypes: ['Ticket', 'Bill', 'Payment', 'Expense', 'Announcement', 'Document', 'Visitor', 'User', 'Unit', 'Association', 'MenuConfig', 'Receipt', 'Account'],
  endpoints: () => ({}),
});
