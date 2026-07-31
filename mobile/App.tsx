import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { store } from './src/store';
import { setCredentials, setMobileConfig } from './src/store/authSlice';
import { setAuthToken, api } from './src/api/client';
import type { MobileConfigResponse } from './src/api/types';
import RootNavigator from './src/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync();

function AppInner() {
  useEffect(() => {
    // Restore saved token on launch
    const restore = async () => {
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          setAuthToken(token);
          // We don't have the full user object cached, so we do a lightweight
          // profile fetch to restore the session.
          const profile = await api.get<{ data: any }>('/auth/profile');
          store.dispatch(setCredentials({ access_token: token, user: profile.data }));
          // Also restore mobile config
          const cfg = await api.get<MobileConfigResponse>('/system/mobile-config');
          store.dispatch(setMobileConfig(cfg.data));
        }
      } catch {
        // Token expired or network error — user will need to log in again
        await SecureStore.deleteItemAsync('access_token').catch(() => {});
      } finally {
        SplashScreen.hideAsync();
      }
    };
    restore();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </Provider>
  );
}
