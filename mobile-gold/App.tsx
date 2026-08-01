import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { store } from './src/store';
import { setCredentials, setMobileConfig } from './src/store/authSlice';
import { api, setAuthToken } from './src/api/client';
import RootNavigator from './src/navigation/RootNavigator';
import type { MobileConfigResponse } from './src/api/types';

SplashScreen.preventAutoHideAsync();

/** Catches render errors that would otherwise show as a blank white screen. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 32, backgroundColor: '#F5F3FF' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#dc2626', marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>
            {String(this.state.error?.message ?? this.state.error)}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={{ backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          setAuthToken(token);
          const user = await api.get<{ data: any }>('/auth/me');
          store.dispatch(setCredentials({ access_token: token, user: user.data }));
          try {
            const cfg = await api.get<MobileConfigResponse>('/system/mobile-config');
            store.dispatch(setMobileConfig(cfg));
          } catch {}
        }
      } catch {
        await SecureStore.deleteItemAsync('access_token').catch(() => {});
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  return <RootNavigator />;
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppInner />
        </ErrorBoundary>
      </SafeAreaProvider>
    </Provider>
  );
}
