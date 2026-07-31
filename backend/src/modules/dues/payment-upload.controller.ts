import { Request, Response, NextFunction } from 'express';
import { paymentUploadService } from './payment-upload.service';

class PaymentUploadController {

  // GET /dues/payments/upload/template
  async downloadTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const associationId = req.user!.association_id;
      const buf = await paymentUploadService.generateTemplate(associationId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="SmartAppt_PaymentUpload_Template.xlsx"');
      res.send(buf);
    } catch (err) {
      next(err);
    }
  }

  // POST /dues/payments/upload/preview
  async previewUpload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded.' });
        return;
      }
      const associationId = req.user!.association_id;
      const rows = await paymentUploadService.previewUpload(associationId, req.file.buffer);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  }

  // POST /dues/payments/upload/apply
  async applyUpload(req: Request, res: Response, next: NextFunction) {
    try {
      const associationId = req.user!.association_id;
      const { rows } = req.body as { rows: Parameters<typeof paymentUploadService.applyUpload>[1] };
      if (!Array.isArray(rows)) {
        res.status(400).json({ message: '`rows` must be an array.' });
        return;
      }
      const result = await paymentUploadService.applyUpload(associationId, rows, req.user!.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const paymentUploadController = new PaymentUploadController();
