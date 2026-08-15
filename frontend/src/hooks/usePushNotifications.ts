import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { IS_NATIVE } from './usePlatform';
import { useUpdateFcmTokenMutation } from '../store/api/authApi';

/**
 * Registers this device for push and keeps the server's `fcm_token` in sync
 * with reality.
 *
 * Native only — there is no FCM registration on web, and asking a desktop
 * browser for notification permission for a feature it can't act on is the
 * kind of prompt that trains people to reflexively deny every permission
 * request an app ever makes.
 *
 * The plugin import is dynamic so this file does not fail to load on a web
 * build that has never run `npx cap sync` and so has no native push runtime
 * to bind to.
 */
export function usePushNotifications() {
  const navigate = useNavigate();
  const token = useSelector((s: RootState) => s.auth.access_token);
  const [updateFcmToken] = useUpdateFcmTokenMutation();
  const registered = useRef(false);

  useEffect(() => {
    if (!IS_NATIVE || !token || registered.current) return;
    registered.current = true;

    let removeListeners: (() => void) | undefined;

    (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const perm = await PushNotifications.checkPermissions();
      let granted = perm.receive === 'granted';
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        const req = await PushNotifications.requestPermissions();
        granted = req.receive === 'granted';
      }
      // Declined is left alone rather than re-asked every launch — repeatedly
      // prompting after a "no" is how apps end up permanently muted at the OS
      // level. Settling M-PIN in Settings > Notifications is the way back.
      if (!granted) return;

      await PushNotifications.register();

      // addListener resolves to the handle rather than returning it directly
      // as of Capacitor 6 — each one needs awaiting before it can be removed.
      const onRegistration = await PushNotifications.addListener('registration', (t) => {
        updateFcmToken({ fcm_token: t.value });
      });
      const onRegistrationError = await PushNotifications.addListener('registrationError', (err) => {
        // eslint-disable-next-line no-console
        console.error('Push registration failed', err);
      });

      // Tapping a notification while the app is closed or backgrounded.
      // Chat is the one type with somewhere specific to go; everything else
      // just opens the app, which is what tapping it already does by default.
      const onAction = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data as Record<string, string> | undefined;
        if (data?.type === 'CHAT_MESSAGE' && data.channel_id) {
          navigate(`/mobile/chat/${data.channel_id}`);
        }
      });

      removeListeners = () => {
        onRegistration.remove();
        onRegistrationError.remove();
        onAction.remove();
      };
    })();

    return () => removeListeners?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}

/** Called on logout so a signed-out device stops receiving another
 *  session's messages — the same reasoning as clearing the remembered
 *  phone number on "Change number". */
export async function clearFcmToken(updateFcmToken: (arg: { fcm_token: string | null }) => unknown) {
  if (!IS_NATIVE) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
  } catch { /* plugin not present on this build — nothing to clean up */ }
  updateFcmToken({ fcm_token: null });
}
