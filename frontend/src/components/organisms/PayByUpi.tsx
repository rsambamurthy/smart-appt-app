import { useState, CSSProperties } from 'react';
import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';
import {
  useLazyGetUpiIntentQuery, useSubmitUpiClaimMutation,
} from '../../store/api/upiApi';

/**
 * Pay a bill by opening the resident's own UPI app.
 *
 * The app cannot learn whether the payment succeeded — a `upi://pay` link gives
 * no callback — so this deliberately does not claim to. It opens the UPI app,
 * then asks for the reference number the resident can see on their own screen,
 * and records that as a claim awaiting the treasurer.
 *
 * Two things are worth not "improving" later:
 *
 *  - The reference is typed by the resident, not guessed. It is the only
 *    evidence anyone has, and it is what the treasurer matches against the
 *    bank statement.
 *  - Nothing here marks the bill paid. It says "to be confirmed", because that
 *    is true, and because the alternative lets a resident settle their own
 *    arrears with a button.
 */

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const field: CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 9,
  border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box',
};

const primary: CSSProperties = {
  width: '100%', padding: '13px', borderRadius: 10, border: 'none',
  background: '#15803d', color: '#fff', fontSize: 15.5, fontWeight: 700,
  cursor: 'pointer', minHeight: 48,
};

type Step = 'idle' | 'opening' | 'confirming' | 'done';

export default function PayByUpi({
  billId, onClaimed,
}: {
  billId: string;
  /** Called once a claim is lodged, so the parent can refetch. */
  onClaimed?: () => void;
}) {
  const [fetchIntent, { isFetching }] = useLazyGetUpiIntentQuery();
  const [submitClaim, { isLoading: submitting }] = useSubmitUpiClaimMutation();

  const [step, setStep]       = useState<Step>('idle');
  const [error, setError]     = useState('');
  const [amount, setAmount]   = useState(0);
  const [intentRef, setRef]   = useState('');
  const [payee, setPayee]     = useState('');
  const [vpa, setVpa]         = useState('');
  const [utr, setUtr]         = useState('');
  const [paidOn, setPaidOn]   = useState(() => new Date().toISOString().slice(0, 10));

  const openUpiApp = async () => {
    setError('');
    try {
      const res = await fetchIntent(billId).unwrap();
      const d = res.data;

      if (d.pending_claim) {
        setError(
          `A payment of ₹${money(d.pending_claim.amount)} is already waiting to be confirmed `
          + `(reference ${d.pending_claim.upi_reference}). Ask the treasurer if it is taking too long.`,
        );
        return;
      }

      setAmount(d.amount);
      setRef(d.intent_ref);
      setPayee(d.payee_name);
      setVpa(d.upi_vpa);

      if (Capacitor.isNativePlatform()) {
        // Deliberately NOT gated behind AppLauncher.canOpenUrl. On Android that
        // check is documented as broken for URL *schemes* — it works for
        // package names — so it answered "no UPI app" on a phone with PhonePe
        // installed. Attempting the launch and reacting to the failure is the
        // only reliable signal.
        try {
          await AppLauncher.openUrl({ url: d.upi_uri });
        } catch {
          setError(
            'Could not open a UPI app. If PhonePe, Google Pay or Paytm is installed, '
            + 'try again — otherwise pay by another method.',
          );
          return;
        }
      } else {
        // On a desktop browser there is nothing to open; the resident is
        // presumably paying from their phone separately.
        window.location.href = d.upi_uri;
      }

      // The UPI app is now in front. When they come back, they need to tell us
      // what happened, because nothing else will.
      setStep('confirming');
    } catch (e) {
      const msg = (e as { data?: { message?: string } })?.data?.message;
      setError(msg ?? 'Could not start the payment. Please try again.');
    }
  };

  const lodgeClaim = async () => {
    setError('');
    try {
      await submitClaim({
        bill_id:       billId,
        amount,
        upi_reference: utr.trim(),
        paid_on:       paidOn,
        intent_ref:    intentRef,
      }).unwrap();
      setStep('done');
      onClaimed?.();
    } catch (e) {
      const msg = (e as { data?: { message?: string } })?.data?.message;
      setError(msg ?? 'Could not record the payment.');
    }
  };

  if (step === 'done') {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#15803d' }}>
          Paid — to be confirmed
        </div>
        <div style={{ fontSize: 13, color: '#166534', marginTop: 4, lineHeight: 1.5 }}>
          Thank you. The treasurer will check this against the association's bank
          account and confirm it, usually within a day or two. Your bill will show
          as paid once they do.
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5',
                      borderRadius: 9, padding: '10px 12px', marginBottom: 10,
                      fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {step === 'idle' && (
        <button onClick={openUpiApp} disabled={isFetching} style={primary}>
          {isFetching ? 'Preparing…' : 'Pay by UPI'}
        </button>
      )}

      {step === 'confirming' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0',
                      borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
            Did the payment go through?
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3, marginBottom: 12, lineHeight: 1.5 }}>
            Your UPI app shows a reference or UTR number on the receipt. Enter it
            here so the treasurer can match it to the association's bank account.
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            UPI reference / UTR
          </label>
          <input
            style={{ ...field, marginTop: 4, marginBottom: 10, letterSpacing: '0.04em' }}
            value={utr}
            onChange={e => setUtr(e.target.value.replace(/\s/g, ''))}
            placeholder="e.g. 418523104567"
            inputMode="numeric"
            autoComplete="off"
          />

          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Date paid
          </label>
          <input
            type="date"
            style={{ ...field, marginTop: 4, marginBottom: 12 }}
            value={paidOn}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setPaidOn(e.target.value)}
          />

          <div style={{ fontSize: 13, color: '#1e293b', marginBottom: 12,
                        background: '#f8fafc', borderRadius: 7, padding: '8px 10px' }}>
            <div>Amount: <strong>₹{money(amount)}</strong></div>
            {/* The payee is often an individual — a treasurer's own account —
                so naming it here stops the "who is this person?" moment in the
                UPI app that makes residents abandon the payment. */}
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              Paid to <strong>{payee}</strong>{vpa ? ` · ${vpa}` : ''}
            </div>
          </div>

          <button
            onClick={lodgeClaim}
            disabled={submitting || utr.trim().length < 6}
            style={{ ...primary, opacity: utr.trim().length < 6 ? 0.5 : 1 }}
          >
            {submitting ? 'Recording…' : 'I have paid'}
          </button>

          <button
            onClick={() => { setStep('idle'); setUtr(''); setError(''); }}
            style={{ width: '100%', padding: '11px', marginTop: 8, borderRadius: 10,
                     border: '1px solid #cbd5e1', background: '#fff',
                     color: '#64748b', fontSize: 14, cursor: 'pointer' }}
          >
            Payment did not go through
          </button>
        </div>
      )}
    </div>
  );
}
