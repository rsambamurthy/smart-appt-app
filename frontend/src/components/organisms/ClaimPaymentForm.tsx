import { useState, CSSProperties } from 'react';
import { useSubmitUpiClaimMutation } from '../../store/api/upiApi';

/**
 * "I have paid" — the resident's side of a payment nobody can verify yet.
 *
 * Shared deliberately. This form first existed only behind the Pay-by-UPI
 * button, which meant anyone who paid by scanning the QR on their notice had
 * no way to tell the system they had paid at all. Since scanning the QR is the
 * route that actually works — UPI apps decline intents into personal VPAs —
 * that left the working path with no way to close the loop.
 *
 * Nothing here settles a bill. It records what the resident says, with the
 * reference their own payment app gave them, for a treasurer to check against
 * the bank.
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

export default function ClaimPaymentForm({
  billId, amount, intentRef, onDone, onCancel, cancelLabel,
}: {
  billId: string;
  /** What the bill says is outstanding. The resident can correct it. */
  amount: number;
  intentRef?: string;
  onDone?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [submit, { isLoading }] = useSubmitUpiClaimMutation();

  const [utr, setUtr]       = useState('');
  const [paid, setPaid]     = useState(amount);
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError]   = useState('');
  const [done, setDone]     = useState(false);

  const lodge = async () => {
    setError('');
    try {
      await submit({
        bill_id:       billId,
        amount:        paid,
        upi_reference: utr.trim(),
        paid_on:       paidOn,
        intent_ref:    intentRef,
      }).unwrap();
      setDone(true);
      onDone?.();
    } catch (e) {
      const msg = (e as { data?: { message?: string } })?.data?.message;
      setError(msg ?? 'Could not record the payment.');
    }
  };

  if (done) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#15803d' }}>
          Paid — to be confirmed
        </div>
        <div style={{ fontSize: 13, color: '#166534', marginTop: 4, lineHeight: 1.5 }}>
          Thank you. The treasurer will check this against the association's bank
          account and confirm it. Your bill will show as paid once they do.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>
        Tell us about your payment
      </div>
      <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3, marginBottom: 12,
                    lineHeight: 1.5 }}>
        Your UPI app shows a reference or UTR number on the receipt. Enter it here
        so the treasurer can match it against the association's bank account.
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5',
                      borderRadius: 8, padding: '9px 11px', marginBottom: 10,
                      fontSize: 12.5, color: '#b91c1c', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

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

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Amount paid
          </label>
          {/* Editable, because part payments happen and a resident who paid
              ₹2,000 of ₹2,975 must be able to say so rather than overstate it. */}
          <input
            type="number" step="0.01" min="0"
            style={{ ...field, marginTop: 4, marginBottom: 12 }}
            value={paid}
            onChange={e => setPaid(Number(e.target.value))}
          />
        </div>
        <div style={{ flex: 1 }}>
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
        </div>
      </div>

      {paid > 0 && Math.abs(paid - amount) > 0.005 && (
        <div style={{ fontSize: 12, color: '#b45309', marginBottom: 10 }}>
          The bill is ₹{money(amount)}. You are reporting ₹{money(paid)} — the
          balance will stay outstanding.
        </div>
      )}

      <button
        onClick={lodge}
        disabled={isLoading || utr.trim().length < 6 || !(paid > 0)}
        style={{ ...primary, opacity: utr.trim().length < 6 || !(paid > 0) ? 0.5 : 1 }}
      >
        {isLoading ? 'Recording…' : 'I have paid'}
      </button>

      {onCancel && (
        <button
          onClick={onCancel}
          style={{ width: '100%', padding: '11px', marginTop: 8, borderRadius: 10,
                   border: '1px solid #cbd5e1', background: '#fff',
                   color: '#64748b', fontSize: 14, cursor: 'pointer' }}
        >
          {cancelLabel ?? 'Cancel'}
        </button>
      )}
    </div>
  );
}
