import { useEffect, useRef, useState, CSSProperties } from 'react';
import QRCode from 'qrcode';
import { useGetDueNoticeQuery } from '../../store/api/upiApi';
import ClaimPaymentForm from './ClaimPaymentForm';

/**
 * A due notice for one bill, with a UPI QR to pay it.
 *
 * The QR exists because of a real limitation rather than a preference. UPI
 * apps decline `upi://pay` intents that deep-link money into personal VPAs —
 * PhonePe refuses outright and tells the user to "use a mobile number, UPI ID,
 * or QR code". A QR is the route those apps sanction: the resident scans it
 * with their own app, on their own terms.
 *
 * It carries the identical URI the intent would have used, so a scan and a tap
 * can never pay different amounts to different places.
 *
 * The VPA is also printed as text. A QR is useless to someone reading this on
 * the same phone they would scan with, and useless on a printed sheet held by
 * someone whose camera will not focus — so the fallback is always visible.
 */

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const row: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 12,
  padding: '7px 0', fontSize: 13.5,
};

const btn: CSSProperties = {
  padding: '9px 14px', borderRadius: 9, border: '1px solid #cbd5e1',
  background: '#fff', color: '#334155', fontSize: 13.5, cursor: 'pointer',
  fontWeight: 600,
};

export default function DueNotice({ billId, onClose }: { billId: string; onClose?: () => void }) {
  const { data, isLoading, error } = useGetDueNoticeQuery(billId);
  const [qr, setQr] = useState<string>('');
  // Scanning the QR is the route that actually works, so the notice must also
  // be where a resident says they have paid. Without this the working path had
  // no way to close the loop, and the treasurer's queue stayed empty.
  const [claiming, setClaiming] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const d = data?.data;

  useEffect(() => {
    if (!d?.payment?.upi_uri) { setQr(''); return; }
    // Error correction M, because these get printed, photocopied and
    // photographed off a noticeboard.
    QRCode.toDataURL(d.payment.upi_uri, { errorCorrectionLevel: 'M', margin: 1, width: 320 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [d?.payment?.upi_uri]);

  const print = () => {
    const html = sheetRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Due Notice — ${d?.bill.flat_number ?? ''}</title><style>
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 24pt; }
        .no-print { display: none; }
        img  { max-width: 200px; }
        hr   { border: none; border-top: 1px solid #999; margin: 10pt 0; }
      </style></head><body>${html}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const shareText = () => {
    if (!d) return '';
    const lines = [
      `${d.association.name}`,
      `Due notice — Flat ${d.bill.flat_number}${d.bill.block ? ` ${d.bill.block}` : ''}`,
      `${d.bill.label}`,
      `Amount due: ₹${money(d.amounts.due)}`,
      `Due date: ${fmtDate(d.bill.due_date)}`,
      `Reference: ${d.bill.reference}`,
    ];
    if (d.payment) {
      lines.push('', `Pay by UPI to ${d.payment.upi_vpa} (${d.payment.payee_name})`);
    }
    return lines.join('\n');
  };

  if (isLoading) {
    return <div style={{ padding: 24, color: '#94a3b8', fontSize: 13 }}>Loading…</div>;
  }
  if (error || !d) {
    return (
      <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5',
                    borderRadius: 10, fontSize: 13.5, color: '#b91c1c' }}>
        Could not load this notice.
      </div>
    );
  }

  const settled = d.amounts.due <= 0;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                  maxWidth: 560, margin: '0 auto', overflow: 'hidden' }}>

      <div ref={sheetRef} style={{ padding: '20px 22px' }}>

        {/* Who is asking, and for what */}
        <div style={{ textAlign: 'center', paddingBottom: 12,
                      borderBottom: '2px solid #1e293b' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>
            {d.association.name}
          </div>
          {d.association.address && (
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
              {d.association.address}
            </div>
          )}
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b',
                        marginTop: 8, letterSpacing: '0.08em' }}>
            DUE NOTICE
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between',
                      gap: 16, flexWrap: 'wrap', margin: '14px 0' }}>
          <div style={{ fontSize: 13 }}>
            <div style={{ color: '#64748b', fontSize: 11.5 }}>Flat</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {d.bill.flat_number}{d.bill.block ? ` · ${d.bill.block}` : ''}
            </div>
            {d.bill.resident && (
              <div style={{ color: '#475569', marginTop: 2 }}>{d.bill.resident}</div>
            )}
          </div>
          <div style={{ fontSize: 13, textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: 11.5 }}>Reference</div>
            <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{d.bill.reference}</div>
            <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 6 }}>Due date</div>
            <div style={{ fontWeight: 700, color: d.bill.overdue ? '#b91c1c' : '#1e293b' }}>
              {fmtDate(d.bill.due_date)}{d.bill.overdue && ' · overdue'}
            </div>
          </div>
        </div>

        {/* The breakdown, so "why this amount" needs no phone call */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        marginBottom: 4 }}>
            {d.bill.label}
          </div>
          <div style={{ ...row }}>
            <span>Maintenance</span><span>₹{money(d.amounts.base)}</span>
          </div>
          {d.amounts.levy > 0 && (
            <div style={{ ...row }}><span>Levy</span><span>₹{money(d.amounts.levy)}</span></div>
          )}
          {d.amounts.penalty > 0 && (
            <div style={{ ...row, color: '#b45309' }}>
              <span>Late payment penalty</span><span>₹{money(d.amounts.penalty)}</span>
            </div>
          )}
          <div style={{ ...row, borderTop: '1px solid #e2e8f0', fontWeight: 700 }}>
            <span>Total</span><span>₹{money(d.amounts.total)}</span>
          </div>
          {d.amounts.paid > 0 && (
            <div style={{ ...row, color: '#15803d' }}>
              <span>Already paid</span><span>− ₹{money(d.amounts.paid)}</span>
            </div>
          )}
          <div style={{ ...row, borderTop: '2px solid #1e293b', fontWeight: 800,
                        fontSize: 16, color: settled ? '#15803d' : '#b91c1c' }}>
            <span>{settled ? 'Settled' : 'Amount due'}</span>
            <span>₹{money(Math.abs(d.amounts.due))}</span>
          </div>
        </div>

        {d.pending_claim && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0',
                        borderRadius: 8, padding: '9px 11px', marginTop: 12,
                        fontSize: 12.5, color: '#166534' }}>
            A payment of ₹{money(d.pending_claim.amount)} (reference{' '}
            {d.pending_claim.upi_reference}) is awaiting confirmation by the treasurer.
          </div>
        )}

        {/* How to pay */}
        {d.payment && !settled && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed #cbd5e1',
                        textAlign: 'center' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b',
                          textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Scan to pay
            </div>
            {qr && (
              <img src={qr} alt="UPI payment QR code"
                style={{ width: 200, height: 200, margin: '10px auto 6px', display: 'block' }} />
            )}
            <div style={{ fontSize: 13, color: '#1e293b' }}>
              <strong>{d.payment.payee_name}</strong>
            </div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#1e293b' }}>
              {d.payment.upi_vpa}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 8,
                          lineHeight: 1.55, maxWidth: 400, margin: '8px auto 0' }}>
              Open any UPI app, scan this code, and check the amount reads
              ₹{money(d.amounts.due)} before paying. If you cannot scan, pay the
              UPI ID above manually. Afterwards, enter the reference number your
              payment app shows you in SmartAppt so the treasurer can confirm it.
            </div>
          </div>
        )}

        {/* Having paid, the resident needs to say so — nothing else tells us. */}
        {!settled && !d.pending_claim && (
          <div className="no-print" style={{ marginTop: 16 }}>
            {claiming ? (
              <ClaimPaymentForm
                billId={d.bill.id}
                amount={d.amounts.due}
                intentRef={d.bill.reference}
                onDone={() => setClaiming(false)}
                onCancel={() => setClaiming(false)}
              />
            ) : (
              <button
                onClick={() => setClaiming(true)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10,
                  border: '1px solid #15803d', background: '#fff',
                  color: '#15803d', fontSize: 14.5, fontWeight: 700,
                  cursor: 'pointer', minHeight: 46,
                }}>
                I have paid — enter reference
              </button>
            )}
          </div>
        )}

        {!d.payment && !settled && (
          <div style={{ marginTop: 16, padding: '11px 13px', background: '#fffbeb',
                        border: '1px solid #fde68a', borderRadius: 8,
                        fontSize: 12.5, color: '#92400e' }}>
            No UPI ID has been set up for this association yet, so this notice has no
            payment code. Ask the treasurer how to pay.
          </div>
        )}
      </div>

      {/* Actions — outside the printed area */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 22px',
                    borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
        <button onClick={print} style={btn}>Print / Save as PDF</button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={() => (navigator as Navigator & {
              share: (d: { title: string; text: string }) => Promise<void>
            }).share({ title: 'Due notice', text: shareText() }).catch(() => {})}
            style={btn}>
            Share
          </button>
        )}
        {onClose && (
          <button onClick={onClose} style={{ ...btn, marginLeft: 'auto' }}>Close</button>
        )}
      </div>
    </div>
  );
}
