import ExcelJS from 'exceljs';
import prisma from '../../config/database';
import { BillStatus, PaymentMode } from '@prisma/client';
import { journalService } from '../accounting/journal.service';

export interface PaymentUploadPreviewRow {
  row_num:         number;
  flat_number:     string;
  block:           string | null;
  period_month:    number | null;
  period_year:     number | null;
  amount:          number | null;
  mode:            string | null;
  payment_date:    string | null;
  reference_no:    string | null;
  bill_id:         string | null;
  unit_id:         string | null;
  current_status:  string | null;   // existing bill status
  status:          'create' | 'skip' | 'error';
  error?:          string;
}

const MODES = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'ONLINE'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function errRow(row_num: number, flat_number: string, error: string): PaymentUploadPreviewRow {
  return { row_num, flat_number, block: null, period_month: null, period_year: null, amount: null, mode: null, payment_date: null, reference_no: null, bill_id: null, unit_id: null, current_status: null, status: 'error', error };
}

class PaymentUploadService {

  // ── Generate Excel Template ──────────────────────────────────────────────────
  async generateTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Payments');

    // Header row
    const headers = ['Flat Number', 'Block', 'Month (1-12)', 'Year', 'Amount (₹)', 'Mode', 'Payment Date', 'Reference No'];
    const headerRow = ws.getRow(1);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a6bcc' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin' } };
    });
    ws.getRow(1).height = 22;

    // Mode dropdown (col F = column 6)
    for (let r = 2; r <= 201; r++) {
      const modeCell = ws.getCell(r, 6);
      modeCell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"CASH,CHEQUE,BANK_TRANSFER,ONLINE"'],
        showErrorMessage: true,
        error: 'Choose from: CASH, CHEQUE, BANK_TRANSFER, ONLINE',
        errorTitle: 'Invalid Mode',
      };
    }

    // Column widths
    const widths = [14, 10, 14, 8, 14, 16, 14, 18];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // Sample rows (2 examples, greyed out)
    const examples = [
      ['A101', 'Block A', 6, 2025, 2500, 'CASH', '2025-06-10', ''],
      ['B202', '',        6, 2025, 2500, 'CHEQUE', '2025-06-12', 'CHQ001234'],
    ];
    examples.forEach((ex, ri) => {
      const row = ws.getRow(ri + 2);
      ex.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.font = { color: { argb: 'FF94a3b8' }, italic: true };
      });
      // Format date column
      const dateCell = row.getCell(7);
      dateCell.numFmt = 'yyyy-mm-dd';
    });

    // Notes sheet
    const notes = wb.addWorksheet('Notes');
    notes.getColumn(1).width = 60;
    const noteLines = [
      'PAYMENT BULK UPLOAD — INSTRUCTIONS',
      '',
      'Column Guide:',
      '• Flat Number  — exact flat/unit number (e.g. A101, 202B)',
      '• Block        — block or tower (leave blank if not applicable)',
      '• Month        — billing period month (1–12)',
      '• Year         — billing period year (e.g. 2025)',
      '• Amount       — payment amount in ₹',
      '• Mode         — CASH / CHEQUE / BANK_TRANSFER / ONLINE',
      '• Payment Date — date payment was received (YYYY-MM-DD)',
      '• Reference No — cheque number, UTR, etc. (optional)',
      '',
      'Rules:',
      '• The bill for the given Flat / Month / Year must already exist.',
      '• Bills already marked PAID will be skipped.',
      '• Partial payments are allowed.',
      '• Delete the 2 example rows before uploading.',
    ];
    noteLines.forEach((line, i) => {
      const cell = notes.getCell(i + 1, 1);
      cell.value = line;
      if (i === 0) cell.font = { bold: true, size: 12 };
    });

    ws.state = 'visible';
    notes.state = 'visible';

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ── Preview Upload ───────────────────────────────────────────────────────────
  async previewUpload(associationId: string, fileBuffer: Buffer): Promise<PaymentUploadPreviewRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer);

    const ws = wb.getWorksheet('Payments');
    if (!ws) throw new Error('Sheet "Payments" not found. Please use the provided template.');

    // Load all units for this association
    const units = await prisma.unit.findMany({
      where: { association_id: associationId },
      select: { id: true, flat_number: true, block: true },
    });
    const unitKey = (flat: string, block: string | null) =>
      `${flat.trim().toLowerCase()}|${(block ?? '').trim().toLowerCase()}`;
    const unitMap = new Map(units.map(u => [unitKey(u.flat_number, u.block), u]));

    const preview: PaymentUploadPreviewRow[] = [];
    const dataRows: ExcelJS.Row[] = [];
    ws.eachRow((row, rowNum) => { if (rowNum >= 2) dataRows.push(row); });

    for (const row of dataRows) {
      const rowNum = row.number;
      const flatVal  = String(row.getCell(1).value ?? '').trim();
      const blockVal = String(row.getCell(2).value ?? '').trim() || null;
      const monthVal = row.getCell(3).value;
      const yearVal  = row.getCell(4).value;
      const amtVal   = row.getCell(5).value;
      const modeVal  = String(row.getCell(6).value ?? '').trim().toUpperCase();
      const dateVal  = row.getCell(7).value;
      const refVal   = String(row.getCell(8).value ?? '').trim() || null;

      if (!flatVal && !monthVal && !amtVal) continue; // blank row

      if (!flatVal) { preview.push(errRow(rowNum, '', 'Flat Number is required')); continue; }

      // Month
      const month = monthVal != null ? Number(monthVal) : NaN;
      if (isNaN(month) || month < 1 || month > 12) {
        preview.push(errRow(rowNum, flatVal, `Month must be 1–12, got: "${monthVal}"`)); continue;
      }

      // Year
      const year = yearVal != null ? Number(yearVal) : NaN;
      if (isNaN(year) || year < 2000 || year > 2100) {
        preview.push(errRow(rowNum, flatVal, `Year invalid: "${yearVal}"`)); continue;
      }

      // Amount
      const amount = amtVal != null ? Number(amtVal) : NaN;
      if (isNaN(amount) || amount <= 0) {
        preview.push(errRow(rowNum, flatVal, `Amount must be > 0, got: "${amtVal}"`)); continue;
      }

      // Mode
      if (!MODES.includes(modeVal)) {
        preview.push(errRow(rowNum, flatVal, `Mode must be one of: ${MODES.join(', ')}. Got: "${modeVal}"`)); continue;
      }

      // Payment date
      let paymentDateStr: string | null = null;
      if (dateVal) {
        const d = dateVal instanceof Date ? dateVal : new Date(String(dateVal));
        if (isNaN(d.getTime())) {
          preview.push(errRow(rowNum, flatVal, `Payment Date invalid: "${dateVal}"`)); continue;
        }
        paymentDateStr = d.toISOString().split('T')[0];
      } else {
        paymentDateStr = new Date().toISOString().split('T')[0];
      }

      // Find unit
      const unit = unitMap.get(unitKey(flatVal, blockVal));
      if (!unit) {
        const label = blockVal ? `${flatVal} / ${blockVal}` : flatVal;
        preview.push(errRow(rowNum, flatVal, `Unit not found: ${label}`)); continue;
      }

      // Find bill
      const bill = await prisma.bill.findFirst({
        where: { association_id: associationId, unit_id: unit.id, period_month: month, period_year: year },
        select: { id: true, status: true, total_amount: true },
      });
      if (!bill) {
        preview.push(errRow(rowNum, flatVal, `No bill found for ${flatVal} — ${MONTH_NAMES[month - 1]} ${year}`)); continue;
      }

      if (bill.status === BillStatus.PAID || bill.status === BillStatus.WAIVED) {
        preview.push({
          row_num: rowNum, flat_number: flatVal, block: blockVal,
          period_month: month, period_year: year,
          amount, mode: modeVal, payment_date: paymentDateStr, reference_no: refVal,
          bill_id: bill.id, unit_id: unit.id, current_status: bill.status,
          status: 'skip',
        });
        continue;
      }

      preview.push({
        row_num: rowNum, flat_number: flatVal, block: blockVal,
        period_month: month, period_year: year,
        amount, mode: modeVal, payment_date: paymentDateStr, reference_no: refVal,
        bill_id: bill.id, unit_id: unit.id, current_status: bill.status,
        status: 'create',
      });
    }

    return preview;
  }

  // ── Apply Upload ─────────────────────────────────────────────────────────────
  async applyUpload(associationId: string, rows: PaymentUploadPreviewRow[], recordedById: string) {
    const workRows = rows.filter(r => r.status === 'create');
    let created = 0;

    for (const row of workRows) {
      if (!row.bill_id || !row.unit_id || !row.amount || !row.mode || !row.payment_date) continue;

      const bill = await prisma.bill.findFirst({
        where: { id: row.bill_id, association_id: associationId },
        include: { unit: { select: { flat_number: true } } },
      });
      if (!bill) continue;
      if (bill.status === BillStatus.PAID || bill.status === BillStatus.WAIVED) continue;

      const payment = await prisma.payment.create({
        data: {
          association_id: associationId,
          bill_id:        row.bill_id,
          unit_id:        row.unit_id,
          amount:         row.amount,
          payment_mode:   row.mode as PaymentMode,
          payment_date:   new Date(row.payment_date),
          reference_no:   row.reference_no ?? undefined,
          recorded_by:    recordedById,
          gateway:        'manual',
        },
      });

      // Update bill status
      const totalPaid = await prisma.payment.aggregate({
        where: { bill_id: row.bill_id },
        _sum: { amount: true },
      });
      const paidTotal = Number(totalPaid._sum.amount ?? 0);
      const billTotal = Number(bill.total_amount);
      const newStatus = paidTotal >= billTotal ? BillStatus.PAID : BillStatus.PARTIAL;
      await prisma.bill.update({ where: { id: row.bill_id }, data: { status: newStatus } });

      // Auto-post JE (idempotent)
      journalService.postPaymentReceived(
        associationId,
        payment.id,
        row.amount,
        row.mode,
        `Bulk payment — Flat ${bill.unit?.flat_number ?? ''} (${row.period_month}/${row.period_year})`,
        new Date(row.payment_date),
      );

      created++;
    }

    return { created };
  }
}

export const paymentUploadService = new PaymentUploadService();
