import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser, MobileConfig, MobileConfigResponse } from '../api/types';

interface AuthState {
  access_token: string | null;
  user: AuthUser | null;
  mobileConfig: MobileConfig | null;
}

const initialState: AuthState = {
  access_token: null,
  user: null,
  mobileConfig: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ access_token: string; user: AuthUser }>) {
      state.access_token = action.payload.access_token;
      state.user = action.payload.user;
    },
    setMobileConfig(state, action: PayloadAction<MobileConfigResponse>) {
      state.mobileConfig = action.payload.data ?? null;
    },
    clearCredentials(state) {
      state.access_token = null;
      state.user = null;
      state.mobileConfig = null;
    },
  },
});

export const { setCredentials, setMobileConfig, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
