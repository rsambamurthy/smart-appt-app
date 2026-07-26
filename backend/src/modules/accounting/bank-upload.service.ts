import ExcelJS from 'exceljs';
import { BPCategory, BalanceType } from '@prisma/client';
import prisma from '../../config/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BankUploadPreviewRow {
  row_num:              number;
  code:                 string;
  name:                 string;
  phone:                string | null;
  email:                string | null;
  account_number:       string | null;
  ifsc:                 string | null;
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
  status:               'create' | 'update' | 'skip' | 'error';
  error?:               string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class BankUploadService {

  // ── Template download ──────────────────────────────────────────────────────
  async generateTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SmartAppt';
    wb.created = new Date();

    const ws = wb.addWorksheet('Banks');

    ws.columns = [
      { key: 'code',    width: 14 }, // A
      { key: 'name',    width: 32 }, // B
      { key: 'phone',   width: 15 }, // C
      { key: 'email',   width: 26 }, // D
      { key: 'acctno', width: 22 }, // E
      { key: 'ifsc',    width: 14 }, // F
      { key: 'amount',  width: 22 }, // G
      { key: 'side',    width: 9  }, // H
      { key: 'date',    width: 14 }, // I
    ];

    // ── Header row ─────────────────────────────────────────────────────────
    const hdrFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E3A5F' } };
    const hdr = ws.getRow(1);
    hdr.height = 22;
    hdr.values = [
      'Code *', 'Name *', 'Phone', 'Email',
      'Account Number', 'IFSC Code',
      'Opening Balance (₹)', 'DR / CR', 'As On Date',
    ];
    hdr.eachCell({ includeEmpty: true }, (cell) => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      cell.fill      = hdrFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = {
        top:    { style: 'thin', color: { argb: 'FF3B5998' } },
        bottom: { style: 'thin', color: { argb: 'FF3B5998' } },
        left:   { style: 'thin', color: { argb: 'FF3B5998' } },
        right:  { style: 'thin', color: { argb: 'FF3B5998' } },
      };
    });

    // ── Hint row ────────────────────────────────────────────────────────────
    const ins = ws.getRow(2);
    ins.height = 14;
    ins.values = [
      '← required', '← required', 'optional', 'optional',
      'optional', 'optional',
      '← number', '← DR or CR', '← date',
    ];
    ins.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { italic: true, color: { argb: 'FF6B7280' }, size: 9, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    });

    // ── Data rows ────────────────────────────────────────────────────────────
    const ROWS = 200;

    for (let r = 3; r <= 2 + ROWS; r++) {
      const row  = ws.getRow(r);
      const even = (r % 2 === 0);
      const bg   = even ? 'FFFAFAFA' : 'FFFFFFFF';

      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font   = { color: { argb: 'FF111827' }, size: 11, name: 'Calibri' };
        cell.border = {
          top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };
      }

      // G: currency
      row.getCell(7).numFmt = '#,##0.00';

      // H: DR / CR dropdown
      row.getCell(8).dataValidation = {
        type:             'list',
        formulae:         ['"DR,CR"'],
        showErrorMessage: true,
        errorTitle:       'Invalid',
        error:            'Enter DR or CR',
        showInputMessage: true,
        promptTitle:      'Balance side',
        prompt:           'DR = Debit   CR = Credit',
      };
      row.getCell(8).alignment = { horizontal: 'center' };

      // I: date format
      row.getCell(9).numFmt = 'dd-mmm-yyyy';
    }

    // Freeze + auto-filter
    ws.views      = [{ state: 'frozen', ySplit: 2, xSplit: 0, topLeftCell: 'A3' }];
    ws.autoFilter = { from: 'A1', to: 'I1' };

    const raw = await wb.xlsx.writeBuffer();
    return Buffer.from(raw);
  }

  // ── Preview upload ─────────────────────────────────────────────────────────
  async previewUpload(associationId: string, fileBuffer: Buffer): Promise<BankUploadPreviewRow[]> {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(fileBuffer as any);

    const ws = wb.getWorksheet('Banks') ?? wb.worksheets[0];
    if (!ws) return [];

    const existingBanks = await prisma.businessPartner.findMany({
      where:  { association_id: associationId, bp_category: BPCategory.BANK },
      select: { id: true, code: true },
    });
    const bankByCode = new Map(existingBanks.map(b => [b.code.toUpperCase(), b]));

    const preview: BankUploadPreviewRow[] = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum <= 2) return; // skip header + hint

      const code = row.getCell(1).value?.toString()?.trim();
      const name = row.getCell(2).value?.toString()?.trim();

      if (!code && !name) return; // blank row

      const phone    = row.getCell(3).value?.toString()?.trim() || null;
      const email    = row.getCell(4).value?.toString()?.trim() || null;
      const acctNo   = row.getCell(5).value?.toString()?.trim() || null;
      const ifsc     = row.getCell(6).value?.toString()?.trim() || null;
      const amtRaw   = row.getCell(7).value;
      const sideRaw  = row.getCell(8).value?.toString()?.trim()?.toUpperCase();
      const dateRaw  = row.getCell(9).value;

      if (!code) {
        preview.push(this.errRow(rowNum, '', name ?? '', phone, email, acctNo, ifsc, null, null, null, 'Code is required'));
        return;
      }
      if (!name) {
        preview.push(this.errRow(rowNum, code, '', phone, email, acctNo, ifsc, null, null, null, 'Name is required'));
        return;
      }

      // Opening balance amount
      const amount = (amtRaw != null && amtRaw !== '') ? Number(amtRaw) : null;
      if (amount !== null && isNaN(amount)) {
        preview.push(this.errRow(rowNum, code, name, phone, email, acctNo, ifsc, null, null, null, 'Opening balance is not a valid number'));
        return;
      }

      // DR / CR
      let side: BalanceType | null = null;
      if      (sideRaw === 'DR') side = BalanceType.DEBIT;
      else if (sideRaw === 'CR') side = BalanceType.CREDIT;
      else if (sideRaw && sideRaw !== '') {
        preview.push(this.errRow(rowNum, code, name, phone, email, acctNo, ifsc, null, null, null, `Invalid DR/CR value: "${sideRaw}"`));
        return;
      }

      // If amount given but no side, default DEBIT (bank accounts are assets — debit normal)
      if (amount && amount > 0 && !side) side = BalanceType.DEBIT;

      // Date
      let dateStr: string | null = null;
      if (dateRaw) {
        const d = dateRaw instanceof Date ? dateRaw : new Date(String(dateRaw));
        if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
      }

      const existing = bankByCode.get(code.toUpperCase());
      const status: 'create' | 'update' = existing ? 'update' : 'create';

      preview.push({
        row_num: rowNum, code, name, phone, email,
        account_number: acctNo, ifsc,
        opening_balance: amount, opening_balance_type: side, opening_balance_date: dateStr,
        status,
      });
    });

    return preview;
  }

  // ── Apply confirmed rows ───────────────────────────────────────────────────
  async applyUpload(
    associationId: string,
    rows: BankUploadPreviewRow[],
  ): Promise<{ created: number; updated: number }> {
    const workRows = rows.filter(r => r.status === 'create' || r.status === 'update');
    if (workRows.length === 0) return { created: 0, updated: 0 };

    const existingBanks = await prisma.businessPartner.findMany({
      where:  { association_id: associationId, bp_category: BPCategory.BANK },
      select: { id: true, code: true },
    });
    const bankByCode = new Map(existingBanks.map(b => [b.code.toUpperCase(), b]));

    let created = 0, updated = 0;

    for (const row of workRows) {
      const data = {
        name:                 row.name,
        phone:                row.phone,
        email:                row.email,
        account_number:       row.account_number,
        ifsc:                 row.ifsc,
        opening_balance:      row.opening_balance,
        opening_balance_type: row.opening_balance_type,
        opening_balance_date: row.opening_balance_date ? new Date(row.opening_balance_date) : null,
      };

      const existing = bankByCode.get(row.code.toUpperCase());
      if (existing) {
        await prisma.businessPartner.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.businessPartner.create({
          data: {
            association_id: associationId,
            code:           row.code,
            bp_category:    BPCategory.BANK,
            ...data,
          },
        });
        created++;
      }
    }

    return { created, updated };
  }

  // ── Helper ─────────────────────────────────────────────────────────────────
  private errRow(
    rowNum: number, code: string, name: string,
    phone: string | null, email: string | null,
    acctNo: string | null, ifsc: string | null,
    amount: number | null, side: BalanceType | null, date: string | null,
    error: string,
  ): BankUploadPreviewRow {
    return {
      row_num: rowNum, code, name, phone, email,
      account_number: acctNo, ifsc,
      opening_balance: amount, opening_balance_type: side, opening_balance_date: date,
      status: 'error', error,
    };
  }
}

export const bankUploadService = new BankUploadService();
