import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  otpRequestSchema, otpVerifySchema, refreshTokenSchema,
  mpinVerifySchema, mpinSetSchema, mpinResetSchema, mpinChangeSchema,
} from './auth.schema';

const router = Router();

// Configure Google OAuth strategy only if credentials are present
const googleOAuthEnabled =
  !!process.env.GOOGLE_CLIENT_ID &&
  !!process.env.GOOGLE_CLIENT_SECRET &&
  !!process.env.GOOGLE_CALLBACK_URL;

if (googleOAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      },
      (_accessToken, _refreshToken, profile, done) => done(null, profile as unknown as Express.User),
    ),
  );
}

router.use(passport.initialize());

// POST /auth/otp/request
router.post('/otp/request', validate(otpRequestSchema), (req, res, next) =>
  authController.requestOtp(req, res, next),
);

// POST /auth/otp/verify
router.post('/otp/verify', validate(otpVerifySchema), (req, res, next) =>
  authController.verifyOtp(req, res, next),
);

// GET /auth/google
router.get('/google', (req, res, next) => {
  if (!googleOAuthEnabled) return res.status(501).json({ error: 'Google OAuth not configured' });
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

// GET /auth/google/callback
router.get('/google/callback', (req, res, next) => {
  if (!googleOAuthEnabled) return res.status(501).json({ error: 'Google OAuth not configured' });
  return passport.authenticate('google', { session: false, failureRedirect: '/login' })(req, res, next);
}, (req, res, next) => authController.googleCallback(req, res, next));

// POST /auth/token/refresh
router.post('/token/refresh', validate(refreshTokenSchema), (req, res, next) =>
  authController.refreshToken(req, res, next),
);

// POST /auth/logout
router.post('/logout', authenticate, (req, res, next) =>
  authController.logout(req as never, res, next),
);

// GET /auth/me
router.get('/me', authenticate, (req, res, next) =>
  authController.me(req as never, res, next),
);

// GET /auth/mpin/status?phone=...
router.get('/mpin/status', (req, res, next) =>
  authController.getMpinStatus(req, res, next),
);

// POST /auth/mpin/verify  (login with M-PIN)
router.post('/mpin/verify', validate(mpinVerifySchema), (req, res, next) =>
  authController.verifyMpin(req, res, next),
);

// POST /auth/mpin/set  (authenticated — set M-PIN after OTP login)
router.post('/mpin/set', authenticate, validate(mpinSetSchema), (req, res, next) =>
  authController.setMpin(req as never, res, next),
);

// POST /auth/mpin/reset  (unauthenticated — reset via OTP)
router.post('/mpin/reset', validate(mpinResetSchema), (req, res, next) =>
  authController.resetMpin(req, res, next),
);

// POST /auth/mpin/change  (authenticated — change with current M-PIN)
router.post('/mpin/change', authenticate, validate(mpinChangeSchema), (req, res, next) =>
  authController.changeMpin(req as never, res, next),
);

export default router;
