import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { otpRequestSchema, otpVerifySchema, refreshTokenSchema } from './auth.schema';

const router = Router();

// Configure Google OAuth strategy
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
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false }),
);

// GET /auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res, next) => authController.googleCallback(req, res, next),
);

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

export default router;
