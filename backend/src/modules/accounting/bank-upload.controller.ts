import { Request, Response } from 'express';
import { bankUploadService, BankUploadPreviewRow } from './bank-upload.service';

class BankUploadController {

  downloadTemplate = async (_req: Request, res: Response) => {
    try {
      const buffer = await bankUploadService.generateTemplate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="SmartAppt_Bank_Template.xlsx"');
      res.send(buffer);
    } catch (err) {
      console.error('[BankUpload] downloadTemplate:', err);
      res.status(500).json({ message: 'Failed to generate template' });
    }
  };

  previewUpload = async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const data = await bankUploadService.previewUpload(req.user!.association_id, req.file.buffer);
      res.json({ data });
    } catch (err) {
      console.error('[BankUpload] previewUpload:', err);
      res.status(500).json({ message: 'Failed to parse uploaded file' });
    }
  };

  applyUpload = async (req: Request, res: Response) => {
    try {
      const rows: BankUploadPreviewRow[] = req.body.rows;
      if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows must be an array' });
      const data = await bankUploadService.applyUpload(req.user!.association_id, rows);
      res.json({ data });
    } catch (err) {
      console.error('[BankUpload] applyUpload:', err);
      res.status(500).json({ message: 'Failed to apply upload' });
    }
  };
}

export const bankUploadController = new BankUploadController();
