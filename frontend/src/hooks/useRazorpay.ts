import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Browser } from '@capacitor/browser';
import { duesApi } from '../store/api/duesApi';
import { IS_NATIVE } from './usePlatform';
import type { AppDispatch, RootState } from '../store';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

// Razorpay checkout.js response passed to the handler callback
interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface PayOptions {
  billId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  /** Called with the RTK verifyPayment result on success */
  onSuccess?: (paymentId: string) => void;
  /** Called with a human-readable error message on failure */
  onError?: (msg: string) => void;
  /**
   * Native (Capacitor) only: called after the resident returns from the
   * Razorpay Custom Tab, before onSuccess/onError. There's no reliable way
   * to know the outcome from here — the checkout ran in a separate browser
   * process, not this app's JS — so callers should use this to refetch and
   * let the bill's real status (paid, partial, still unpaid) speak for
   * itself rather than assuming success.
   */
  onReturn?: () => void;
}

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

/**
 * Native (Capacitor) checkout path. Razorpay's checkout.js — same script
 * the web build uses below — hides UPI when it detects it's running inside
 * an embedded Android/iOS WebView (the `; wv` marker in the WebView's own
 * identity string): a UPI payment means handing off to a banking app and
 * getting control back, and neither Razorpay nor the UPI apps themselves
 * trust a generic WebView to complete that hand-back reliably. Opening the
 * exact same web checkout page in a real Chrome Custom Tab / SFSafariView
 * instead of this app's own WebView sidesteps that entirely — it's a
 * genuine browser as far as Razorpay and the UPI apps are concerned.
 *
 * The web app already has a self-contained page (PaymentPage.tsx) that does
 * this same order-create + checkout.js + verify flow for a normal logged-in
 * web visit at /dues/pay/:billId; this opens its sibling route,
 * /dues/pay-native/:billId, rather than duplicating checkout logic for
 * native. That route skips the app's login-role guard (RoleRoute), because
 * this is a fresh browser process with no access to this app's Redux/session
 * storage — the access token is passed once via the URL instead, which is
 * all that page needs to authenticate its own API calls.
 */
async function payViaCustomTab(opts: PayOptions, accessToken: string | null, dispatch: AppDispatch): Promise<void> {
  if (!accessToken) {
    opts.onError?.('You need to be logged in to pay.');
    return;
  }
  const webAppUrl = import.meta.env.VITE_WEB_APP_URL;
  if (!webAppUrl) {
    opts.onError?.('Payment is not configured for this app build. Please contact support.');
    return;
  }

  const url = `${webAppUrl.replace(/\/$/, '')}/dues/pay-native/${opts.billId}?token=${encodeURIComponent(accessToken)}`;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = async () => {
      if (settled) return;
      settled = true;
      // handle may not be assigned yet if browserFinished somehow fires
      // before the addListener promise resolves (it won't in practice —
      // the tab has to actually open and close first) — skip removal
      // rather than throw on `undefined.remove()`.
      await handle?.remove().catch(() => {});
      // Refetch rather than assume an outcome — see the onReturn doc comment.
      dispatch(duesApi.util.invalidateTags(['Bill', 'Payment']));
      opts.onReturn?.();
      resolve();
    };

    let handle: { remove: () => Promise<void> };
    Browser.addListener('browserFinished', finish).then((h) => { handle = h; });

    Browser.open({ url, toolbarColor: '#C4572B' }).catch((err: unknown) => {
      settled = true;
      opts.onError?.((err as Error)?.message ?? 'Could not open payment page.');
      resolve();
    });
  });
}

export function useRazorpay() {
  // Typed dispatch — the plain useDispatch() cannot accept RTK Query thunks,
  // and without it the mutation results degrade to `unknown`.
  const dispatch = useDispatch<AppDispatch>();
  const accessToken = useSelector((s: RootState) => s.auth.access_token);
  const busyRef = useRef(false);

  const pay = useCallback(async (opts: PayOptions) => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      if (IS_NATIVE) {
        await payViaCustomTab(opts, accessToken, dispatch);
        return;
      }

      // 1. Load checkout.js if not already loaded
      await loadCheckoutScript();

      // 2. Create Razorpay order on backend
      const initiateResult = await dispatch(
        duesApi.endpoints.initiatePayment.initiate({ bill_id: opts.billId })
      );

      if ('error' in initiateResult) {
        const errMsg = (initiateResult.error as { data?: { detail?: string } })?.data?.detail ?? 'Could not create payment order.';
        opts.onError?.(errMsg);
        return;
      }

      const { order_id, amount, key_id } = initiateResult.data.data;

      // 3. Open Razorpay modal
      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay({
          key: key_id ?? import.meta.env.VITE_RAZORPAY_KEY_ID,
          order_id,
          amount: Math.round(Number(amount) * 100),
          currency: 'INR',
          name: 'SmartAppt Gold',
          description: 'Maintenance Dues Payment',
          prefill: {
            name: opts.userName,
            contact: opts.userPhone,
            email: opts.userEmail ?? '',
          },
          theme: { color: '#C4572B' },

          handler: async (response: RazorpayResponse) => {
            // 4. Verify signature on backend
            try {
              const verifyResult = await dispatch(
                duesApi.endpoints.verifyPayment.initiate({
                  bill_id: opts.billId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                })
              );

              if ('error' in verifyResult) {
                opts.onError?.('Payment captured but verification failed. Please contact support.');
              } else {
                opts.onSuccess?.(verifyResult.data.data.payment_id ?? response.razorpay_payment_id);
              }
            } catch {
              opts.onError?.('Verification request failed. Please check your bill status.');
            } finally {
              resolve();
            }
          },

          modal: {
            ondismiss: () => {
              opts.onError?.('Payment cancelled.');
              resolve();
            },
          },
        });

        rzp.open();
      });

    } catch (err) {
      opts.onError?.((err as Error).message ?? 'Payment failed. Please try again.');
    } finally {
      busyRef.current = false;
    }
  }, [dispatch, accessToken]);

  return { pay };
}
