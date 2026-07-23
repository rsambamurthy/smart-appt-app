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
import logger from './utils/logger';

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
import { associationsController } from './modules/associations/associations.controller';
import { validate } from './middleware/validate';
import { registerAssociationSchema } from './modules/associations/associations.schema';

const app = express();
const httpServer = createServer(app);

// ── Health check — MUST be registered before all middleware ───────────────────
// Railway healthchecker hits this; it must respond even if DB/Redis are down.
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Socket.io (visitor approval real-time) ────────────────────────────────────
export const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  logger.info('Socket connected', { id: socket.id });
  socket.on('join:unit', (unitId: string) => socket.join(`unit:${unitId}`));
  socket.on('join:gate', (associationId: string) => socket.join(`gate:${associationId}`));
  socket.on('join:association', (associationId: string) => socket.join(`association:${associationId}`));
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
app.use(`${API}/receipts`, receiptsRouter);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { app, httpServer };
