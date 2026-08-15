import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { ipLimiter } from './middleware/rateLimiter';
import { requestId } from './middleware/auth';
import { requestContext } from './utils/request-context';
import logger from './utils/logger';
import { verifyToken } from './config/jwt';
import prisma from './config/database';

// Module routers
import authRouter from './modules/auth/auth.routes';
import usersRouter from './modules/users/users.routes';
import maintenanceRouter from './modules/maintenance/maintenance.routes';
import duesRouter from './modules/dues/dues.routes';
import expensesRouter from './modules/expenses/expenses.routes';
import announcementsRouter from './modules/announcements/announcements.routes';
import visitorsRouter from './modules/visitors/visitors.routes';
import adminRouter from './modules/admin/admin.routes';
import associationsRouter from './modules/associations/associations.routes';
import systemRouter from './modules/system/system.routes';
import receiptsRouter from './modules/receipts/receipts.routes';
import accountingRouter from './modules/accounting/accounting.routes';
import subscriptionsRouter from './modules/subscriptions/subscriptions.routes';
import governanceRouter from './modules/governance/governance.routes';
import analyticsRouter from './modules/analytics/analytics.routes';
import assistantRouter from './modules/assistant/assistant.routes';
import chatRouter from './modules/chat/chat.routes';
import { associationsController } from './modules/associations/associations.controller';
import { validate } from './middleware/validate';
import { registerAssociationSchema } from './modules/associations/associations.schema';

const app = express();
const httpServer = createServer(app);

// ── Health check — MUST be registered before all middleware ───────────────────
// Railway healthchecker hits this; it must respond even if DB/Redis are down.
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Socket.io (visitor approval, announcements, chat real-time) ───────────────
export const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

interface SocketUser {
  id: string;
  association_id: string;
  role: string;
}

/**
 * Every socket must authenticate before it can join anything.
 *
 * This used not to be true: any client could connect and join
 * `unit:<any id>` or `association:<any id>` by simply supplying the id, no
 * token required. That was tolerable while the only things flowing over it
 * were visitor pings and "an announcement changed, go refetch" — nothing a
 * stranger joining a room could actually read. Chat messages are not that;
 * the payload itself travels over the socket, so an unauthenticated join
 * would mean a stranger could listen to residents' conversations. The
 * frontend has sent `auth: { token }` on every connection since the
 * announcements feature shipped — this middleware is what finally checks it.
 */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub, deleted_at: null },
      select: { id: true, association_id: true, role: true, is_active: true },
    });
    if (!user || !user.is_active) return next(new Error('unauthorized'));

    (socket.data as { user: SocketUser }).user = {
      id: user.id, association_id: user.association_id, role: user.role,
    };
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const me = (socket.data as { user: SocketUser }).user;
  logger.info('Socket connected', { id: socket.id, userId: me.id });

  // Existing rooms — behaviour unchanged, now simply gated behind a real
  // login instead of an unauthenticated handshake.
  socket.on('join:unit', (unitId: string) => socket.join(`unit:${unitId}`));
  socket.on('join:gate', (associationId: string) => socket.join(`gate:${associationId}`));
  socket.on('join:association', (associationId: string) => socket.join(`association:${associationId}`));

  // Chat rooms — unlike the rooms above, membership is checked against the
  // database rather than trusted from the client, because the thing being
  // protected is the message content itself, not just a refetch signal.
  socket.on('join:chat:channel', async (channelId: string) => {
    const member = await prisma.chatChannelMember.findUnique({
      where: { channel_id_user_id: { channel_id: channelId, user_id: me.id } },
      select: { id: true },
    });
    if (member) socket.join(`chat:channel:${channelId}`);
  });
  socket.on('leave:chat:channel', (channelId: string) => socket.leave(`chat:channel:${channelId}`));

  socket.on('disconnect', () => logger.info('Socket disconnected', { id: socket.id }));
});

// ── Global middleware ─────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      const allowed = [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'capacitor://localhost',   // Capacitor Android WebView
        'https://localhost',       // Capacitor iOS WebView
        'http://localhost',
      ].filter(Boolean);
      if (allowed.includes(origin)) return callback(null, true);
      // Also allow ngrok URLs for development
      if (origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok-free.dev') || origin.endsWith('.ngrok.io')) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all in dev — tighten for production
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
// Opens the per-request context (IP, user-agent) that the audit trail reads.
// Must come before the routers so every handler runs inside it.
app.use(requestContext);
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.path === '/health',
  }),
);
app.use(ipLimiter);

// ── API routes ────────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRouter);
app.use(`${API}/users`, usersRouter);
app.use(`${API}/maintenance`, maintenanceRouter);
app.use(`${API}/dues`, duesRouter);
app.use(`${API}/expenses`, expensesRouter);
app.use(`${API}/announcements`, announcementsRouter);
app.use(`${API}/visitors`, visitorsRouter);
app.use(`${API}/admin`, adminRouter);
// Public: register new association (no auth — mounted directly to bypass router middleware)
app.post(`${API}/associations/register`, validate(registerAssociationSchema), (req, res, next) =>
  associationsController.register(req, res, next));
app.use(`${API}/associations`, associationsRouter);
app.use(`${API}/system`, systemRouter);
app.use(`${API}/analytics`, analyticsRouter);
app.use(`${API}/receipts`, receiptsRouter);
app.use(`${API}/accounting`, accountingRouter);
app.use(`${API}/subscriptions`, subscriptionsRouter);
app.use(`${API}/governance`, governanceRouter);
app.use(`${API}/assistant`, assistantRouter);
app.use(`${API}/chat`, chatRouter);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { app, httpServer };
