import admin from 'firebase-admin';
import logger from '../utils/logger';

// Initialise Firebase Admin once — skip gracefully if credentials not configured
let fcmInitialized = false;
// Surfaced by the /health/push diagnostic route — this project's Railway log
// viewer has proven unreliable enough mid-investigation that a plain HTTP
// response is the faster way to see this than another round of log-scrolling.
let fcmInitError: string | null = null;
let fcmProjectId: string | null = null;

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '';

  if (!raw || raw.startsWith('<')) {
    // Placeholder or missing — FCM disabled (normal in dev without Firebase)
    fcmInitError = 'FIREBASE_SERVICE_ACCOUNT_JSON is missing or still the placeholder value.';
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not configured — FCM push notifications disabled');
  } else {
    try {
      const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      fcmInitialized = true;
      fcmProjectId = serviceAccount.project_id ?? null;
    } catch (err) {
      fcmInitError = (err as Error).message;
      logger.warn('Firebase Admin init failed — FCM push notifications disabled', {
        error: (err as Error).message,
      });
    }
  }
}

/** The most recent send attempt, whatever came of it — cleared on restart. */
let lastSend: {
  at: string; token_count: number; success_count: number; failure_count: number;
  errors: string[];
} | null = null;

/** Read by the /health/push diagnostic route — never throws, never a secret. */
export function fcmDiagnostics() {
  return {
    initialized: fcmInitialized,
    project_id: fcmProjectId,
    error: fcmInitError,
    last_send: lastSend,
  };
}

class FcmService {
  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
    if (!tokens.length) {
      lastSend = { at: new Date().toISOString(), token_count: 0, success_count: 0, failure_count: 0, errors: ['No token for the recipient — nothing to send to.'] };
      return;
    }
    if (!fcmInitialized) {
      lastSend = { at: new Date().toISOString(), token_count: tokens.length, success_count: 0, failure_count: 0, errors: ['FCM not initialized — see fcmDiagnostics().error.'] };
      return;
    }

    let successCount = 0, failureCount = 0;
    const errors: string[] = [];
    const chunks = this.chunk(tokens, 500);
    for (const chunk of chunks) {
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data,
        });
        successCount += res.successCount;
        failureCount += res.failureCount;
        // The per-token reason (e.g. "registration-token-not-registered" for
        // a stale token, or "SenderId mismatch" for a token registered
        // against a different Firebase project than this service account)
        // is exactly what tells us WHY a send that reached Firebase still
        // didn't produce a notification.
        res.responses.forEach((r) => { if (!r.success && r.error) errors.push(r.error.message); });
      } catch (err) {
        failureCount += chunk.length;
        errors.push((err as Error).message);
        logger.error('FCM send failed', { error: (err as Error).message });
      }
    }
    lastSend = { at: new Date().toISOString(), token_count: tokens.length, success_count: successCount, failure_count: failureCount, errors };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  }
}

export const fcmService = new FcmService();
