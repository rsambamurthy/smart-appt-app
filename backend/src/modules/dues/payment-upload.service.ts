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

  // ── Generate Excel Template (pre-filled with unpaid/partial bills) ───────────
  async generateTemplate(associationId: string): Promise<Buffer> {
    // Fetch all unpaid / partial bills with their unit info
    const bills = await prisma.bill.findMany({
      where: {
        association_id: associationId,
        status: { in: [BillStatus.UNPAID, BillStatus.PARTIAL] },
      },
      include: { unit: { select: { flat_number: true, block: true } } },
      orderBy: [{ period_year: 'asc' }, { period_month: 'asc' }, { unit: { flat_number: 'asc' } }],
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Payments');

    // ── Header row ──────────────────────────────────────────────────────────────
    const headers = [
      'Flat Number', 'Block', 'Month (1-12)', 'Year',
      'Amount (₹)', 'Mode', 'Payment Date', 'Reference No',
    ];
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

    // Column widths
    const widths = [14, 10, 14, 8, 14, 16, 14, 18];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // ── Pre-filled data rows ────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const preFilledFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8f4ff' } };

    bills.forEach((bill, idx) => {
      const r = idx + 2;
      const row = ws.getRow(r);

      // Pre-filled columns (light blue background, locked values)
      const flatCell = row.getCell(1);
      flatCell.value = bill.unit.flat_number;
      flatCell.fill = preFilledFill;
      flatCell.font = { bold: true, color: { argb: 'FF1e40af' } };

      const blockCell = row.getCell(2);
      blockCell.value = bill.unit.block ?? '';
      blockCell.fill = preFilledFill;
      blockCell.font = { color: { argb: 'FF1e40af' } };

      const monthCell = row.getCell(3);
      monthCell.value = bill.period_month;
      monthCell.fill = preFilledFill;
      monthCell.font = { color: { argb: 'FF1e40af' } };

      const yearCell = row.getCell(4);
      yearCell.value = bill.period_year;
      yearCell.fill = preFilledFill;
      yearCell.font = { color: { argb: 'FF1e40af' } };

      // User-fillable columns — Amount pre-filled with outstanding balance
      const totalAmount = Number(bill.total_amount);
      const amtCell = row.getCell(5);
      amtCell.value = totalAmount;
      amtCell.numFmt = '#,##0.00';

      // Mode dropdown
      row.getCell(6).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"CASH,CHEQUE,BANK_TRANSFER,ONLINE"'],
        showErrorMessage: true,
        error: 'Choose from: CASH, CHEQUE, BANK_TRANSFER, ONLINE',
        errorTitle: 'Invalid Mode',
      };

      // Payment date defaults to today
      const dateCell = row.getCell(7);
      dateCell.value = today;
      dateCell.numFmt = 'yyyy-mm-dd';

      // Reference No — blank
      row.getCell(8).value = '';
    });

    // If no unpaid bills, add one blank example row
    if (bills.length === 0) {
      const row = ws.getRow(2);
      row.getCell(1).value = '';
      row.getCell(2).value = '';
      row.getCell(3).value = '';
      row.getCell(4).value = '';
      row.getCell(6).dataValidation = {
        type: 'list', allowBlank: true,
        formulae: ['"CASH,CHEQUE,BANK_TRANSFER,ONLINE"'],
        showErrorMessage: true, error: 'Choose from: CASH, CHEQUE, BANK_TRANSFER, ONLINE', errorTitle: 'Invalid Mode',
      };
    }

    // ── Notes sheet ─────────────────────────────────────────────────────────────
    const notes = wb.addWorksheet('Notes');
    notes.getColumn(1).width = 65;
    const noteLines = [
      `PAYMENT BULK UPLOAD — Pre-filled with ${bills.length} unpaid / partial bill${bills.length !== 1 ? 's' : ''}`,
      '',
      'Blue cells (Flat, Block, Month, Year) are pre-filled — do not change.',
      'Fill in: Amount (₹), Mode, Payment Date, Reference No (optional).',
      '',
      'Mode values: CASH / CHEQUE / BANK_TRANSFER / ONLINE',
      'Payment Date format: YYYY-MM-DD',
      '',
      'Rules:',
      '• Delete rows you do not want to record.',
      '• Partial payments are allowed — change the Amount.',
      '• Bills already PAID are not included in this download.',
    ];
    noteLines.forEach((line, i) => {
      const cell = notes.getCell(i + 1, 1);
      cell.value = line;
      if (i === 0) cell.font = { bold: true, size: 12 };
      else if (i === 2) cell.font = { color: { argb: 'FF1e40af' }, italic: true };
    });

    ws.state = 'visible';
    notes.state = 'visible';

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ── Preview Upload ───────────────────────────────────────────────────────────
  async previewUpload(associationId: string, fileBuffer: Buffer): Promise<PaymentUploadPreviewRow[]> {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(fileBuffer as any);

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
