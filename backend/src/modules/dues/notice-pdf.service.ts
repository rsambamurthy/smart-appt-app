import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

/**
 * The due notice, rendered server-side as a PDF.
 *
 * A second renderer of the same document is a liability — two places to change
 * when the bill layout changes, and a chance for the printed figure to disagree
 * with the screen. It exists anyway because WhatsApp needs a file, and the
 * browser's print dialog cannot produce one on a server.
 *
 * The mitigation is that both renderers are fed by the SAME upi.service.notice()
 * payload, including the identical `upi_uri`. Layout may drift; the amount and
 * the payee cannot.
 */

export interface NoticeData {
  association: { name: string; address: string };
  bill: {
    reference: string; label: string;
    flat_number: string; block: string | null;
    resident: string | null;
    due_date: string; overdue: boolean;
  };
  amounts: {
    base: number; levy: number; penalty: number;
    total: number; paid: number; due: number;
  };
  payment: { upi_uri: string; upi_vpa: string; payee_name: string } | null;
}

const money = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export async function renderNoticePdf(d: NoticeData): Promise<Buffer> {
  // The QR is generated first: if it fails there is no point producing a
  // notice that tells someone to scan nothing.
  let qrPng: Buffer | null = null;
  if (d.payment?.upi_uri) {
    qrPng = await QRCode.toBuffer(d.payment.upi_uri, {
      errorCorrectionLevel: 'M', margin: 1, width: 300, type: 'png',
    });
  }

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const W = doc.page.width - 96;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.fontSize(16).font('Helvetica-Bold').text(d.association.name, { align: 'center' });
  if (d.association.address) {
    doc.moveDown(0.2).fontSize(9).font('Helvetica')
       .fillColor('#555').text(d.association.address, { align: 'center' });
  }
  doc.moveDown(0.6).fontSize(10).font('Helvetica-Bold').fillColor('#333')
     .text('DUE NOTICE', { align: 'center', characterSpacing: 2 });
  doc.moveDown(0.5);
  doc.moveTo(48, doc.y).lineTo(48 + W, doc.y).lineWidth(1.5).strokeColor('#222').stroke();
  doc.moveDown(1);

  // ── Who, and which bill ───────────────────────────────────────────────────
  const top = doc.y;
  doc.fontSize(9).font('Helvetica').fillColor('#666').text('FLAT', 48, top);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#111')
     .text(`${d.bill.flat_number}${d.bill.block ? ` · ${d.bill.block}` : ''}`, 48, top + 12);
  if (d.bill.resident) {
    doc.fontSize(10).font('Helvetica').fillColor('#444').text(d.bill.resident, 48, top + 30);
  }

  const rightX = 48 + W / 2;
  doc.fontSize(9).font('Helvetica').fillColor('#666')
     .text('REFERENCE', rightX, top, { width: W / 2, align: 'right' });
  doc.fontSize(11).font('Courier-Bold').fillColor('#111')
     .text(d.bill.reference, rightX, top + 12, { width: W / 2, align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#666')
     .text('DUE DATE', rightX, top + 30, { width: W / 2, align: 'right' });
  doc.fontSize(11).font('Helvetica-Bold')
     .fillColor(d.bill.overdue ? '#b91c1c' : '#111')
     .text(`${fmtDate(d.bill.due_date)}${d.bill.overdue ? '  · OVERDUE' : ''}`,
           rightX, top + 42, { width: W / 2, align: 'right' });

  doc.y = top + 66;
  doc.moveDown(0.5);

  // ── Breakdown ─────────────────────────────────────────────────────────────
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#666')
     .text(d.bill.label.toUpperCase(), 48, doc.y, { characterSpacing: 0.5 });
  doc.moveDown(0.4);

  const line = (label: string, amount: number, opts: { bold?: boolean; colour?: string } = {}) => {
    const y = doc.y;
    doc.fontSize(11)
       .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
       .fillColor(opts.colour ?? '#111');
    doc.text(label, 48, y, { width: W * 0.6 });
    doc.text(`Rs. ${money(amount)}`, 48 + W * 0.6, y, { width: W * 0.4, align: 'right' });
    doc.y = y + 16;
  };

  const rule = (weight = 0.5, colour = '#ccc') => {
    doc.moveTo(48, doc.y).lineTo(48 + W, doc.y).lineWidth(weight).strokeColor(colour).stroke();
    doc.moveDown(0.35);
  };

  line('Maintenance', d.amounts.base);
  if (d.amounts.levy > 0)    line('Levy', d.amounts.levy);
  if (d.amounts.penalty > 0) line('Late payment penalty', d.amounts.penalty, { colour: '#b45309' });
  rule();
  line('Total', d.amounts.total, { bold: true });
  if (d.amounts.paid > 0) line('Already paid', -d.amounts.paid, { colour: '#15803d' });
  rule(1.5, '#222');

  const settled = d.amounts.due <= 0;
  doc.fontSize(13).font('Helvetica-Bold').fillColor(settled ? '#15803d' : '#b91c1c');
  const yTot = doc.y;
  doc.text(settled ? 'SETTLED' : 'AMOUNT DUE', 48, yTot, { width: W * 0.6 });
  doc.text(`Rs. ${money(Math.abs(d.amounts.due))}`, 48 + W * 0.6, yTot,
           { width: W * 0.4, align: 'right' });
  doc.y = yTot + 24;

  // ── Pay ───────────────────────────────────────────────────────────────────
  if (d.payment && qrPng && !settled) {
    doc.moveDown(0.6);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#666')
       .text('SCAN TO PAY', { align: 'center', characterSpacing: 1 });
    doc.moveDown(0.4);

    const size = 160;
    doc.image(qrPng, (doc.page.width - size) / 2, doc.y, { width: size, height: size });
    doc.y += size + 10;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111')
       .text(d.payment.payee_name, { align: 'center' });
    doc.fontSize(11).font('Courier').fillColor('#111')
       .text(d.payment.upi_vpa, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8.5).font('Helvetica').fillColor('#666').text(
      `Open any UPI app, scan the code, and check the amount reads Rs. ${money(d.amounts.due)} `
      + 'before paying. If you cannot scan, pay the UPI ID above manually. Afterwards, enter the '
      + 'reference number your payment app shows you in SmartAppt so the treasurer can confirm it.',
      72, doc.y, { width: W - 48, align: 'center' },
    );
  }

  doc.end();
  return done;
}
