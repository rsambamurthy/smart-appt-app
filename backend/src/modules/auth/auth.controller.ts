import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AuthRequest } from '../../types';

export class AuthController {
  async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.requestOtp(req.body.phone);
      res.json({ data: { message: 'OTP sent successfully', ...result } });
    } catch (err) { next(err); }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.verifyOtp(req.body.phone, req.body.otp);
      res.json({ data: result });
    } catch (err) { next(err); }
  }

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = req.user as unknown as { id: string; emails?: { value: string }[]; displayName: string };
      const result = await authService.handleGoogleCallback(
        profile.id,
        profile.emails?.[0]?.value ?? '',
        profile.displayName,
      );
      // In production, redirect to frontend with tokens in query or set cookie
      res.json({ data: result });
    } catch (err) { next(err); }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.refreshToken(req.body.refresh_token);
      res.json({ data: result });
    } catch (err) { next(err); }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.user!.id);
      res.json({ data: { message: 'Logged out successfully' } });
    } catch (err) { next(err); }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ data: req.user });
    } catch (err) { next(err); }
  }

  async getMpinStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.getMpinStatus(req.query.phone as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  }

  async verifyMpin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.verifyMpin(req.body.phone, req.body.mpin);
      res.json({ data: result });
    } catch (err) { next(err); }
  }

  async setMpin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.setMpin(req.user!.id, req.body.mpin);
      res.json({ data: { message: 'M-PIN set successfully' } });
    } catch (err) { next(err); }
  }

  async resetMpin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.resetMpin(req.body.phone, req.body.otp, req.body.new_mpin);
      res.json({ data: { message: 'M-PIN reset successfully' } });
    } catch (err) { next(err); }
  }

  async changeMpin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.changeMpin(req.user!.id, req.body.current_mpin, req.body.new_mpin);
      res.json({ data: { message: 'M-PIN changed successfully' } });
    } catch (err) { next(err); }
  }
}

export const authController = new AuthController();
