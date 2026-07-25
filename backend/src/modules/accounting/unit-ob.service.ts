import ExcelJS from 'exceljs';
import { BPCategory, BalanceType } from '@prisma/client';
import prisma from '../../config/database';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UnitWithBalance {
  unit_id:              string;
  flat_number:          string;
  block:                string | null;
  floor:                number;
  unit_type:            string | null;
  owner_name:           string | null;
  bp_id:                string | null;
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
}

export interface UnitOBPreviewRow {
  unit_id:              string;
  flat_number:          string;
  block:                string | null;
  status:               'create' | 'update' | 'skip' | 'error';
  opening_balance:      number | null;
  opening_balance_type: BalanceType | null;
  opening_balance_date: string | null;
  error?:               string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class UnitOBService {

  // List all units for the association, merged with their existing BP opening balance data
  async listWithBalances(associationId: string): Promise<UnitWithBalance[]> {
    const [units, bps] = await Promise.all([
      prisma.unit.findMany({
        where:   { association_id: associationId, deleted_at: null },
        include: {
          users: {
            where:  { is_owner: true, is_active: true },
            select: { name: true },
            take:   1,
          },
        },
        orderBy: [{ block: 'asc' }, { floor: 'asc' }, { flat_number: 'asc' }],
      }),
      prisma.businessPartner.findMany({
        where: { association_id: associationId, bp_category: BPCategory.UNIT, unit_id: { not: null } },
      }),
    ]);

    const bpByUnitId = new Map(bps.map(bp => [bp.unit_id!, bp]));

    return units.map(unit => {
      const bp    = bpByUnitId.get(unit.id);
      const owner = unit.users[0];
      return {
        unit_id:              unit.id,
        flat_number:          unit.flat_number,
        block:                unit.block,
        floor:                unit.floor,
        unit_type:            unit.unit_type,
        owner_name:           owner?.name ?? null,
        bp_id:                bp?.id ?? null,
        opening_balance:      bp?.opening_balance != null ? Number(bp.opening_balance) : null,
        opening_balance_type: bp?.opening_balance_type ?? null,
        opening_balance_date: bp?.opening_balance_date
          ? bp.opening_balance_date.toISOString().split('T')[0]
          : null,
      };
    });
  }

  // Generate a protected Excel template pre-filled with unit data.
  // Columns B–F (unit info) are locked; G–I (amount, DR/CR, date) are editable.
  async generateTemplate(associationId: string): Promise<Buffer> {
    const rows = await this.listWithBalances(associationId);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SmartAppt';
    wb.created = new Date();

    const ws = wb.addWorksheet('Unit Opening Balances');

    ws.columns = [
      { key: 'unit_id',  width: 5  }, // A — hidden UUID for upload matching
      { key: 'flat',     width: 12 }, // B
      { key: 'block',    width: 10 }, // C
      { key: 'floor',    width: 8  }, // D
      { key: 'type',     width: 12 }, // E
      { key: 'owner',    width: 26 }, // F
      { key: 'amount',   width: 20 }, // G — editable
      { key: 'side',     width: 9  }, // H — editable
      { key: 'date',     width: 14 }, // I — editable
    ];

    ws.getColumn(1).hidden = true; // hide UUID column

    // ── Row 1: column headers ────────────────────────────────────────────────
    const hdr = ws.getRow(1);
    hdr.height = 22;
    hdr.values = [
      'unit_id', 'Flat No.', 'Block', 'Floor', 'Type', 'Owner / Resident',
      'Opening Balance (₹)', 'DR / CR', 'As On Date',
    ];
    hdr.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.protection = { locked: true };
      if (col === 1) return;
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = {
        top:    { style: 'thin', color: { argb: 'FF3B5998' } },
        bottom: { style: 'thin', color: { argb: 'FF3B5998' } },
        left:   { style: 'thin', color: { argb: 'FF3B5998' } },
        right:  { style: 'thin', color: { argb: 'FF3B5998' } },
      };
    });

    // ── Row 2: hint row ──────────────────────────────────────────────────────
    const ins = ws.getRow(2);
    ins.height = 14;
    ins.values = [
      '', '(read only)', '(read only)', '(read only)', '(read only)', '(read only)',
      '← enter amount', '← DR or CR', '← select date',
    ];
    ins.eachCell({ includeEmpty: true }, (cell) => {
      cell.protection = { locked: true };
      cell.font       = { italic: true, color: { argb: 'FF6B7280' }, size: 9, name: 'Calibri' };
      cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    });

    // ── Data rows ────────────────────────────────────────────────────────────
    rows.forEach((r, idx) => {
      const rn   = idx + 3;
      const even = idx % 2 === 0;
      const lkBg = even ? 'FFF3F4F6' : 'FFE5E7EB';
      const row  = ws.getRow(rn);

      row.values = [
        r.unit_id,
        r.flat_number,
        r.block      ?? '',
        r.floor,
        r.unit_type  ?? '',
        r.owner_name ?? '',
        r.opening_balance ?? null,
        r.opening_balance_type === 'DEBIT'  ? 'DR'
          : r.opening_balance_type === 'CREDIT' ? 'CR' : '',
        r.opening_balance_date ? new Date(r.opening_balance_date) : null,
      ];

      // Lock read-only cols B–F (index 2–6)
      for (let c = 2; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: lkBg } };
        cell.protection = { locked: true };
        cell.font      = { color: { argb: 'FF374151' }, size: 11, name: 'Calibri' };
        cell.border    = {
          top:    { style: 'hair', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } },
        };
      }

      // Editable cols G–I (index 7–9)
      for (let c = 7; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        cell.protection = { locked: false };
        cell.font      = { color: { argb: 'FF111827' }, size: 11, name: 'Calibri' };
        cell.border    = {
          top:    { style: 'thin', color: { argb: 'FFBFDBFE' } },
          bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
          left:   { style: 'thin', color: { argb: 'FFBFDBFE' } },
          right:  { style: 'thin', color: { argb: 'FFBFDBFE' } },
        };
      }

      // G: currency number format
      row.getCell(7).numFmt = '#,##0.00';

      // H: dropdown DR / CR + input message
      row.getCell(8).dataValidation = {
        type: 'list', formulae: ['"DR,CR"'],
        showErrorMessage: true, errorTitle: 'Invalid', error: 'Enter DR or CR',
        showInputMessage: true, promptTitle: 'Balance side',
        prompt: 'DR = Receivable (asset)   CR = Payable (liability)',
      };
      row.getCell(8).alignment = { horizontal: 'center' };

      // I: date format
      row.getCell(9).numFmt = 'dd-mmm-yyyy';
    });

    // Freeze header + hint rows
    ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 0, topLeftCell: 'B3' }];
    ws.autoFilter = { from: 'B1', to: 'I1' };

    // Protect sheet: locked cells cannot be edited; unlocked cells can
    await ws.protect('smartappt2024', {
      selectLockedCells:   true,
      selectUnlockedCells: true,
      formatCells:         false,
      formatColumns:       false,
      formatRows:          false,
      insertColumns:       false,
      insertRows:          false,
      deleteColumns:       false,
      deleteRows:          false,
      sort:                false,
      autoFilter:          false,
    });

    return wb.xlsx.writeBuffer() as Promise<Buffer>;
  }

  // Parse uploaded Excel file and return a preview (create / update / skip / error per row)
  async previewUpload(associationId: string, fileBuffer: Buffer): Promise<UnitOBPreviewRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer);
    const ws = wb.getWorksheet('Unit Opening Balances') ?? wb.worksheets[0];
    if (!ws) return [];

    const [units, bps] = await Promise.all([
      prisma.unit.findMany({ where: { association_id: associationId, deleted_at: null } }),
      prisma.businessPartner.findMany({
        where: { association_id: associationId, bp_category: BPCategory.UNIT, unit_id: { not: null } },
      }),
    ]);
    const unitById   = new Map(units.map(u => [u.id, u]));
    const bpByUnitId = new Map(bps.map(bp => [bp.unit_id!, bp]));

    const preview: UnitOBPreviewRow[] = [];

    ws.eachRow((row, rowNum) => {
      if (rowNum <= 2) return; // skip header + hint

      const unitId  = row.getCell(1).value?.toString()?.trim();
      const amtVal  = row.getCell(7).value;
      const sideVal = row.getCell(8).value?.toString()?.trim()?.toUpperCase();
      const dateVal = row.getCell(9).value;

      if (!unitId) return;

      const unit = unitById.get(unitId);
      if (!unit) {
        preview.push({ unit_id: unitId, flat_number: '?', block: null, status: 'error', opening_balance: null, opening_balance_type: null, opening_balance_date: null, error: 'Unit not found in system' });
        return;
      }

      // Amount
      const amount = (amtVal != null && amtVal !== '') ? Number(amtVal) : null;
      if (amount !== null && isNaN(amount)) {
        preview.push({ unit_id: unitId, flat_number: unit.flat_number, block: unit.block, status: 'error', opening_balance: null, opening_balance_type: null, opening_balance_date: null, error: 'Amount is not a valid number' });
        return;
      }

      // Skip rows with no amount filled
      if (amount === null || amount === 0) {
        preview.push({ unit_id: unitId, flat_number: unit.flat_number, block: unit.block, status: 'skip', opening_balance: null, opening_balance_type: null, opening_balance_date: null });
        return;
      }

      // DR / CR
      let side: BalanceType | null = null;
      if      (sideVal === 'DR') side = BalanceType.DEBIT;
      else if (sideVal === 'CR') side = BalanceType.CREDIT;
      else if (sideVal && sideVal !== '') {
        preview.push({ unit_id: unitId, flat_number: unit.flat_number, block: unit.block, status: 'error', opening_balance: null, opening_balance_type: null, opening_balance_date: null, error: `Invalid DR/CR value: "${sideVal}"` });
        return;
      }

      // Date
      let dateStr: string | null = null;
      if (dateVal) {
        const d = dateVal instanceof Date ? dateVal : new Date(String(dateVal));
        if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
      }

      preview.push({
        unit_id:              unitId,
        flat_number:          unit.flat_number,
        block:                unit.block,
        status:               bpByUnitId.has(unitId) ? 'update' : 'create',
        opening_balance:      amount,
        opening_balance_type: side,
        opening_balance_date: dateStr,
      });
    });

    return preview;
  }

  // Apply confirmed preview rows — create or update BusinessPartner records
  async applyUpload(associationId: string, rows: UnitOBPreviewRow[]): Promise<{ created: number; updated: number }> {
    const workRows = rows.filter(r => r.status === 'create' || r.status === 'update');
    if (workRows.length === 0) return { created: 0, updated: 0 };

    const bps = await prisma.businessPartner.findMany({
      where: { association_id: associationId, bp_category: BPCategory.UNIT, unit_id: { not: null } },
    });
    const bpByUnitId = new Map(bps.map(bp => [bp.unit_id!, bp]));

    const units    = await prisma.unit.findMany({ where: { id: { in: workRows.map(r => r.unit_id) } } });
    const unitById = new Map(units.map(u => [u.id, u]));

    let created = 0, updated = 0;

    for (const row of workRows) {
      const unit = unitById.get(row.unit_id);
      if (!unit) continue;

      const data = {
        opening_balance:      row.opening_balance,
        opening_balance_type: row.opening_balance_type,
        opening_balance_date: row.opening_balance_date ? new Date(row.opening_balance_date) : null,
      };

      const existing = bpByUnitId.get(row.unit_id);
      if (existing) {
        await prisma.businessPartner.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        const raw  = `UNIT-${unit.block ?? ''}${unit.flat_number}`.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
        const code = raw.slice(0, 20);
        await prisma.businessPartner.create({
          data: {
            association_id:  associationId,
            code,
            name:            `Unit ${unit.flat_number}${unit.block ? ' ' + unit.block : ''}`,
            bp_category:     BPCategory.UNIT,
            unit_id:         unit.id,
            ...data,
          },
        });
        created++;
      }
    }

    return { created, updated };
  }
}

export const unitOBService = new UnitOBService();
