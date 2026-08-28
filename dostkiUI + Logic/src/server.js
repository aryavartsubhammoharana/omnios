import app from './app.js';
import { env } from './config/env.js';
import { pool, checkDbHealth } from './config/db.js';
import { redisClient, checkRedisHealth } from './config/redis.js';
import { fileProcessorWorker } from './queues/workers/fileProcessor.worker.js';
import { documentQueue } from './queues/documentQueue.js';

const server = app.listen(env.PORT, async () => {
  console.log(`
  ╔════════════════════════════════════════════════════════════════╗
  ║                 NOTE AI - BACKEND SERVER                       ║
  ║  AI-Powered Classroom Knowledge Management & Learning Platform ║
  ╠════════════════════════════════════════════════════════════════╣
  ║  📡 Port:        ${env.PORT.toString().padEnd(43)} ║
  ║  🌐 API Prefix:  ${env.API_PREFIX.padEnd(43)} ║
  ║  ⚙️  Environment: ${env.NODE_ENV.padEnd(43)} ║
  ║  🤖 AI Engine:   ${env.AI_PROVIDER.padEnd(43)} ║
  ║  💾 Vector Dim:  ${env.EMBEDDING_DIMENSION.toString().padEnd(43)} ║
  ║  📂 Storage:     ${env.STORAGE_DRIVER.padEnd(43)} ║
  ╚════════════════════════════════════════════════════════════════╝
  `);

  // Verify Database Connection
  const dbHealth = await checkDbHealth();
  if (dbHealth.healthy) {
    console.log('✅ PostgreSQL Database connected successfully (pgvector ready)');
  } else {
    console.warn('⚠️  PostgreSQL connection warning:', dbHealth.error);
  }

  // Verify Redis Connection
  const redisHealth = await checkRedisHealth();
  if (redisHealth.healthy) {
    console.log('✅ Redis & BullMQ Queue Worker connected and active');
  } else {
    console.warn('⚠️  Redis connection warning:', redisHealth.error);
  }
});

// Graceful Shutdown Management
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 [${signal}] Signal received. Closing server and flushing connections...`);

  server.close(async () => {
    console.log('🚪 HTTP server closed.');

    // Close BullMQ worker & queue
    if (fileProcessorWorker) {
      await fileProcessorWorker.close();
      console.log('⏹️  BullMQ file processor worker stopped.');
    }

    if (documentQueue) {
      await documentQueue.close();
      console.log('⏹️  BullMQ document queue closed.');
    }

    // Close Redis
    if (redisClient) {
      redisClient.disconnect();
      console.log('⏹️  Redis client disconnected.');
    }

    // Close PostgreSQL pool
    await pool.end();
    console.log('⏹️  PostgreSQL pool terminated.');

    console.log('👋 NOTE AI server terminated gracefully.');
    process.exit(0);
  });

  // Force close after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception thrown:', err);
  process.exit(1);
});
