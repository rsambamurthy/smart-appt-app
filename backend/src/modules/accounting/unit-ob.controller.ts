import { Request, Response } from 'express';
import { unitOBService, UnitOBPreviewRow } from './unit-ob.service';

class UnitOBController {

  listWithBalances = async (req: Request, res: Response) => {
    try {
      const data = await unitOBService.listWithBalances(req.user!.association_id);
      res.json({ data });
    } catch (err) {
      console.error('[UnitOB] listWithBalances:', err);
      res.status(500).json({ message: 'Failed to fetch units' });
    }
  };

  downloadTemplate = async (req: Request, res: Response) => {
    try {
      const buffer = await unitOBService.generateTemplate(req.user!.association_id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="SmartAppt_UnitOB_Template.xlsx"');
      res.send(buffer);
    } catch (err) {
      console.error('[UnitOB] downloadTemplate:', err);
      res.status(500).json({ message: 'Failed to generate template' });
    }
  };

  previewUpload = async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const data = await unitOBService.previewUpload(req.user!.association_id, req.file.buffer);
      res.json({ data });
    } catch (err) {
      console.error('[UnitOB] previewUpload:', err);
      res.status(500).json({ message: 'Failed to parse uploaded file' });
    }
  };

  applyUpload = async (req: Request, res: Response) => {
    try {
      const rows: UnitOBPreviewRow[] = req.body.rows;
      if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows must be an array' });
      const data = await unitOBService.applyUpload(req.user!.association_id, rows);
      res.json({ data });
    } catch (err) {
      console.error('[UnitOB] applyUpload:', err);
      res.status(500).json({ message: 'Failed to apply upload' });
    }
  };
}

export const unitOBController = new UnitOBController();
