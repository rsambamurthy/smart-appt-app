import admin from 'firebase-admin';
import logger from '../utils/logger';

// Initialise Firebase Admin once — skip gracefully if credentials not configured
let fcmInitialized = false;

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '';

  if (!raw || raw.startsWith('<')) {
    // Placeholder or missing — FCM disabled (normal in dev without Firebase)
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not configured — FCM push notifications disabled');
  } else {
    try {
      const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      fcmInitialized = true;
    } catch (err) {
      logger.warn('Firebase Admin init failed — FCM push notifications disabled', {
        error: (err as Error).message,
      });
    }
  }
}

class FcmService {
  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
    if (!tokens.length || !fcmInitialized) return;

    const chunks = this.chunk(tokens, 500);
    for (const chunk of chunks) {
      try {
        await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data,
        });
      } catch (err) {
        logger.error('FCM send failed', { error: (err as Error).message });
      }
    }
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  }
}

export const fcmService = new FcmService();
