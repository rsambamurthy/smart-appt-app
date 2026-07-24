import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  association_id: string;
  association_name?: string | null;
  unit_id?: string | null;
  unit_number?: string | null;
}

interface AuthState {
  access_token: string | null;
  refresh_token: string | null;
  user: AuthUser | null;
}

const stored = {
  access_token: sessionStorage.getItem('access_token'),
  refresh_token: localStorage.getItem('refresh_token'),
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: stored as AuthState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ access_token: string; refresh_token: string; user: AuthUser }>) {
      state.access_token = action.payload.access_token;
      state.refresh_token = action.payload.refresh_token;
      state.user = action.payload.user;
      sessionStorage.setItem('access_token', action.payload.access_token);
      localStorage.setItem('refresh_token', action.payload.refresh_token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    clearCredentials(state) {
      state.access_token = null;
      state.refresh_token = null;
      state.user = null;
      sessionStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    },
    updateAccessToken(state, action: PayloadAction<string>) {
      state.access_token = action.payload;
      sessionStorage.setItem('access_token', action.payload);
    },
  },
});

export const { setCredentials, clearCredentials, updateAccessToken } = authSlice.actions;
export default authSlice.reducer;
