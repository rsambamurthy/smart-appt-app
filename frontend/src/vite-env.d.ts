/// <reference types="vite/client" />

/**
 * Typed environment variables.
 * Add any new VITE_* variable here so `import.meta.env.X` stays type-safe.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  /**
   * Public URL of this same web app, used only by the native (Capacitor)
   * build to open the Razorpay checkout page in a real browser tab instead
   * of the app's own embedded WebView — see hooks/useRazorpay.ts. Unused
   * on the web build itself (window.location.origin is already correct
   * there).
   */
  readonly VITE_WEB_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
