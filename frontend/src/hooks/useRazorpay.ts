import { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { duesApi } from '../store/api/duesApi';

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

export function useRazorpay() {
  const dispatch = useDispatch();
  const busyRef = useRef(false);

  const pay = useCallback(async (opts: PayOptions) => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
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
          name: 'SmartAppt',
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
  }, [dispatch]);

  return { pay };
}
