import { Capacitor } from '@capacitor/core';

export const usePlatform = () => ({
  isMobile: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
});

/** True when running inside the Capacitor native WebView (Android / iOS) */
export const IS_NATIVE = Capacitor.isNativePlatform();
