import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartappt.app',
  appName: 'SmartAppt',
  webDir: 'dist',
  server: {
    // For development with ngrok: set VITE_API_URL to your ngrok URL
    // and this hostname is set automatically from that URL.
    // For production: remove the server block entirely.
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e3a5f',
      showSpinner: false,
    },
  },
};

export default config;
