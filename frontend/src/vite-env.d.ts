/// <reference types="vite/client" />

/**
 * Typed environment variables.
 * Add any new VITE_* variable here so `import.meta.env.X` stays type-safe.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
