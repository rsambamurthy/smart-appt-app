import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
import authReducer from '../features/auth/authSlice';

// Import API modules so their endpoints are registered on baseApi
import './api/authApi';
import './api/maintenanceApi';
import './api/duesApi';
import './api/expensesApi';
import './api/announcementsApi';
import './api/visitorsApi';
import './api/usersApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
