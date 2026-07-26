import { Request, Response } from 'express';
import { vendorUploadService, VendorUploadPreviewRow } from './vendor-upload.service';

class VendorUploadController {

  downloadTemplate = async (req: Request, res: Response) => {
    try {
      const buffer = await vendorUploadService.generateTemplate(req.user!.association_id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="SmartAppt_Vendor_Template.xlsx"');
      res.send(buffer);
    } catch (err) {
      console.error('[VendorUpload] downloadTemplate:', err);
      res.status(500).json({ message: 'Failed to generate template' });
    }
  };

  previewUpload = async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const data = await vendorUploadService.previewUpload(req.user!.association_id, req.file.buffer);
      res.json({ data });
    } catch (err) {
      console.error('[VendorUpload] previewUpload:', err);
      res.status(500).json({ message: 'Failed to parse uploaded file' });
    }
  };

  applyUpload = async (req: Request, res: Response) => {
    try {
      const rows: VendorUploadPreviewRow[] = req.body.rows;
      if (!Array.isArray(rows)) return res.status(400).json({ message: 'rows must be an array' });
      const data = await vendorUploadService.applyUpload(req.user!.association_id, rows);
      res.json({ data });
    } catch (err) {
      console.error('[VendorUpload] applyUpload:', err);
      res.status(500).json({ message: 'Failed to apply upload' });
    }
  };
}

export const vendorUploadController = new VendorUploadController();
