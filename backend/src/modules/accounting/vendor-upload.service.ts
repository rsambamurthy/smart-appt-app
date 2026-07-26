import ExcelJS from 'exceljs';
import { BPCategory, BalanceType } from '@prisma/client';
import prisma from '../../config/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VendorUploadPreviewRow {
  row_num:              number;
  code:                 string;
  name:                 string;
  phone:                string | null;
  email:                string | null;
  gstin:                string | null;
  pan:                  string | null;
  service_type_name:    string | null;
  service_type_id:      string | null;
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
  status:               'create' | 'update' | 'skip' | 'error';
  error?:               string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class VendorUploadService {

  // ── Template download ──────────────────────────────────────────────────────
  async generateTemplate(associationId: string): Promise<Buffer> {
    // Fetch active service types for dropdown
    const serviceTypes = await prisma.serviceType.findMany({
      where:   { association_id: associationId, is_active: true },
      orderBy: { name: 'asc' },
      select:  { name: true },
    });
    const stNames = serviceTypes.map(s => s.name);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SmartAppt';
    wb.created = new Date();

    // ── Hidden sheet: service type list for dropdown formula ─────────────────
    const stSheet = wb.addWorksheet('_ServiceTypes');
    stSheet.state = 'veryHidden';
    stNames.forEach((n, i) => { stSheet.getCell(i + 1, 1).value = n; });

    // ── Main sheet ───────────────────────────────────────────────────────────
    const ws = wb.addWorksheet('Vendors');

    ws.columns = [
      { key: 'code',    width: 14 }, // A
      { key: 'name',    width: 30 }, // B
      { key: 'phone',   width: 15 }, // C
      { key: 'email',   width: 26 }, // D
      { key: 'gstin',   width: 18 }, // E
      { key: 'pan',     width: 13 }, // F
      { key: 'stype',   width: 20 }, // G
      { key: 'amount',  width: 20 }, // H
      { key: 'side',    width: 9  }, // I
      { key: 'date',    width: 14 }, // J
    ];

    // ── Header row ───────────────────────────────────────────────────────────
    const hdrFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E3A5F' } };
    const hdr = ws.getRow(1);
    hdr.height = 22;
    hdr.values = [
      'Code *', 'Name *', 'Phone', 'Email', 'GSTIN', 'PAN',
      'Service Type', 'Opening Balance (₹)', 'DR / CR', 'As On Date',
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

    // ── Hint row ─────────────────────────────────────────────────────────────
    const ins = ws.getRow(2);
    ins.height = 14;
    ins.values = [
      '← required', '← required', 'optional', 'optional', 'optional', 'optional',
      stNames.length ? '← pick from list' : '← (add service types first)',
      '← number', '← DR or CR', '← date',
    ];
    ins.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { italic: true, color: { argb: 'FF6B7280' }, size: 9, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    });

    // ── Sample row ───────────────────────────────────────────────────────────
    const SAMPLE_ROWS = 200; // rows available for data entry

    for (let r = 3; r <= 2 + SAMPLE_ROWS; r++) {
      const row  = ws.getRow(r);
      const even = (r % 2 === 0);
      const bg   = even ? 'FFFAFAFA' : 'FFFFFFFF';

      // A–J styling
      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font      = { color: { argb: 'FF111827' }, size: 11, name: 'Calibri' };
        cell.border    = {
          top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };
      }

      // G: service type dropdown (from hidden sheet, or simple text list)
      if (stNames.length > 0) {
        row.getCell(7).dataValidation = {
          type:             'list',
          formulae:         [`_ServiceTypes!$A$1:$A$${stNames.length}`],
          showErrorMessage: true,
          errorTitle:       'Invalid service type',
          error:            'Please select a value from the list',
          showInputMessage: true,
          promptTitle:      'Service Type',
          prompt:           'Select the vendor service category',
        };
      }

      // H: currency
      row.getCell(8).numFmt  = '#,##0.00';

      // I: DR / CR dropdown
      row.getCell(9).dataValidation = {
        type:             'list',
        formulae:         ['"DR,CR"'],
        showErrorMessage: true,
        errorTitle:       'Invalid',
        error:            'Enter DR or CR',
        showInputMessage: true,
        promptTitle:      'Balance side',
        prompt:           'DR = Debit (asset)   CR = Credit (liability)',
      };
      row.getCell(9).alignment = { horizontal: 'center' };

      // J: date format
      row.getCell(10).numFmt = 'dd-mmm-yyyy';
    }

    // Freeze header rows, auto filter
    ws.views      = [{ state: 'frozen', ySplit: 2, xSplit: 0, topLeftCell: 'A3' }];
    ws.autoFilter = { from: 'A1', to: 'J1' };

    const raw = await wb.xlsx.writeBuffer();
    return Buffer.from(raw);
  }

  // ── Preview upload ─────────────────────────────────────────────────────────
  async previewUpload(associationId: string, fileBuffer: Buffer): Promise<VendorUploadPreviewRow[]> {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(fileBuffer as any);

    const ws = wb.getWorksheet('Vendors') ?? wb.worksheets[0];
    if (!ws) return [];

    // Load existing vendors and service types
    const [existingVendors, serviceTypes] = await Promise.all([
      prisma.businessPartner.findMany({
        where: { association_id: associationId, bp_category: BPCategory.VENDOR },
        select: { id: true, code: true },
      }),
      prisma.serviceType.findMany({
        where: { association_id: associationId },
        select: { id: true, name: true, is_active: true },
      }),
    ]);

    const vendorByCode  = new Map(existingVendors.map(v => [v.code.toUpperCase(), v]));
    const stByName      = new Map(serviceTypes.map(s => [s.name.toLowerCase(), s]));

    const preview: VendorUploadPreviewRow[] = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum <= 2) return; // skip header + hint

      const code  = row.getCell(1).value?.toString()?.trim();
      const name  = row.getCell(2).value?.toString()?.trim();

      // Skip completely empty rows
      if (!code && !name) return;

      const phone     = row.getCell(3).value?.toString()?.trim()  || null;
      const email     = row.getCell(4).value?.toString()?.trim()  || null;
      const gstin     = row.getCell(5).value?.toString()?.trim()  || null;
      const pan       = row.getCell(6).value?.toString()?.trim()  || null;
      const stName    = row.getCell(7).value?.toString()?.trim()  || null;
      const amtRaw    = row.getCell(8).value;
      const sideRaw   = row.getCell(9).value?.toString()?.trim()?.toUpperCase();
      const dateRaw   = row.getCell(10).value;

      // Required field validation
      if (!code) {
        preview.push(this.errRow(rowNum, '', name ?? '', phone, email, gstin, pan, stName, null, null, null, null, 'Code is required'));
        return;
      }
      if (!name) {
        preview.push(this.errRow(rowNum, code, '', phone, email, gstin, pan, stName, null, null, null, null, 'Name is required'));
        return;
      }

      // Service type resolution
      let serviceTypeId: string | null = null;
      if (stName) {
        const st = stByName.get(stName.toLowerCase());
        if (!st) {
          preview.push(this.errRow(rowNum, code, name, phone, email, gstin, pan, stName, null, null, null, null, `Service type "${stName}" not found`));
          return;
        }
        serviceTypeId = st.id;
      }

      // Opening balance amount
      const amount = (amtRaw != null && amtRaw !== '') ? Number(amtRaw) : null;
      if (amount !== null && isNaN(amount)) {
        preview.push(this.errRow(rowNum, code, name, phone, email, gstin, pan, stName, serviceTypeId, null, null, null, 'Opening balance amount is not a valid number'));
        return;
      }

      // DR / CR
      let side: BalanceType | null = null;
      if      (sideRaw === 'DR') side = BalanceType.DEBIT;
      else if (sideRaw === 'CR') side = BalanceType.CREDIT;
      else if (sideRaw && sideRaw !== '') {
        preview.push(this.errRow(rowNum, code, name, phone, email, gstin, pan, stName, serviceTypeId, null, null, null, `Invalid DR/CR value: "${sideRaw}"`));
        return;
      }

      // If amount provided but no DR/CR, default to DEBIT (payable is typical for vendors)
      if (amount && amount > 0 && !side) side = BalanceType.CREDIT;

      // Date
      let dateStr: string | null = null;
      if (dateRaw) {
        const d = dateRaw instanceof Date ? dateRaw : new Date(String(dateRaw));
        if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
      }

      const existing = vendorByCode.get(code.toUpperCase());
      const status: 'create' | 'update' = existing ? 'update' : 'create';

      preview.push({
        row_num:              rowNum,
        code,
        name,
        phone,
        email,
        gstin,
        pan,
        service_type_name:    stName,
        service_type_id:      serviceTypeId,
        opening_balance:      amount,
        opening_balance_type: side,
        opening_balance_date: dateStr,
        status,
      });
    });

    return preview;
  }

  // ── Apply confirmed rows ───────────────────────────────────────────────────
  async applyUpload(
    associationId: string,
    rows: VendorUploadPreviewRow[],
  ): Promise<{ created: number; updated: number }> {
    const workRows = rows.filter(r => r.status === 'create' || r.status === 'update');
    if (workRows.length === 0) return { created: 0, updated: 0 };

    const existingVendors = await prisma.businessPartner.findMany({
      where: { association_id: associationId, bp_category: BPCategory.VENDOR },
      select: { id: true, code: true },
    });
    const vendorByCode = new Map(existingVendors.map(v => [v.code.toUpperCase(), v]));

    let created = 0, updated = 0;

    for (const row of workRows) {
      const data = {
        name:                 row.name,
        phone:                row.phone,
        email:                row.email,
        gstin:                row.gstin,
        pan:                  row.pan,
        service_type_id:      row.service_type_id,
        opening_balance:      row.opening_balance,
        opening_balance_type: row.opening_balance_type,
        opening_balance_date: row.opening_balance_date ? new Date(row.opening_balance_date) : null,
      };

      const existing = vendorByCode.get(row.code.toUpperCase());
      if (existing) {
        await prisma.businessPartner.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.businessPartner.create({
          data: {
            association_id: associationId,
            code:           row.code,
            bp_category:    BPCategory.VENDOR,
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
    phone: string | null, email: string | null, gstin: string | null, pan: string | null,
    stName: string | null, stId: string | null,
    amount: number | null, side: BalanceType | null, date: string | null,
    error: string,
  ): VendorUploadPreviewRow {
    return {
      row_num: rowNum, code, name, phone, email, gstin, pan,
      service_type_name: stName, service_type_id: stId,
      opening_balance: amount, opening_balance_type: side, opening_balance_date: date,
      status: 'error', error,
    };
  }
}

export const vendorUploadService = new VendorUploadService();
