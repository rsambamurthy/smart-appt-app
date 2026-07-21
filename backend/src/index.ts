import 'dotenv/config';
import { httpServer } from './app';
import prisma from './config/database';
import redis from './config/redis';
import logger from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const start = async () => {
  // Verify DB connection
  await prisma.$connect();
  logger.info('Database connected');

  // Verify Redis connection
  await redis.ping();
  logger.info('Redis connected');

  httpServer.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`, { env: process.env.NODE_ENV });
  });
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
