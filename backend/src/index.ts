import 'dotenv/config';
import { httpServer } from './app';
import prisma from './config/database';
import redis from './config/redis';
import logger from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const start = async () => {
  // Start listening first so healthcheck passes immediately
  httpServer.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`, { env: process.env.NODE_ENV });
  });

  // Connect to DB and Redis after server is up
  await prisma.$connect();
  logger.info('Database connected');

  await redis.ping();
  logger.info('Redis connected');
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
