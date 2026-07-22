import 'dotenv/config';
import { httpServer } from './app';
import prisma from './config/database';
import redis from './config/redis';
import logger from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const start = async () => {
  // Start listening FIRST — health check must respond immediately
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`, { env: process.env.NODE_ENV });
      resolve();
    });
  });

  // Connect to DB — log failure but don't crash
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err: any) {
    logger.error('Database connection failed', { error: err.message });
  }

  // Connect to Redis — log failure but don't crash
  try {
    await redis.ping();
    logger.info('Redis connected');
  } catch (err: any) {
    logger.error('Redis connection failed', { error: err.message });
  }
};

const shutdown = async () => {
  logger.info('Shutting down...');
  httpServer.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
