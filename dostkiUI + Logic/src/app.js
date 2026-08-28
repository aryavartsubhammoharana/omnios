import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { env } from './config/env.js';
import { checkDbHealth } from './config/db.js';
import { checkRedisHealth } from './config/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ApiError } from './utils/apiError.js';
import { ApiResponse } from './utils/apiResponse.js';

// Route imports
import authRoutes from './modules/auth/auth.routes.js';
import classroomRoutes from './modules/classroom/classroom.routes.js';
import documentRoutes from './modules/document/document.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';

const app = express();

// 1. Security Headers (configured to allow CDNs for demo UI)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// 2. CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      const allowedOrigins = [env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173'];
      if (allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Request Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// 4. Request Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// 5. Rate Limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests from this IP. Please try again later.',
  },
});
app.use(env.API_PREFIX, limiter);

// 6. Serve static uploads and demo web client
app.use('/uploads', express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));
app.use(express.static(path.resolve(process.cwd(), 'public')));

// 7. System Health Check Endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await checkDbHealth();
  const redisHealth = await checkRedisHealth();

  const isHealthy = dbHealth.healthy && (redisHealth.healthy || env.NODE_ENV === 'development');

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      aiProvider: env.AI_PROVIDER,
      storageDriver: env.STORAGE_DRIVER,
    },
  });
});

// Root route: Serve frontend demo client
app.get('/', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
});

// API Info Route
app.get('/api', (req, res) => {
  return ApiResponse.ok(res, {
    platform: 'NOTE AI - Smart India Hackathon (SIH)',
    version: '1.0.0',
    documentation: `${env.API_PREFIX}/docs`,
  }, 'NOTE AI Classroom Knowledge Management API is running');
});

// 8. Mount Module Routes
app.use(`${env.API_PREFIX}/auth`, authRoutes);
app.use(`${env.API_PREFIX}/classrooms`, classroomRoutes);
app.use(`${env.API_PREFIX}`, documentRoutes);
app.use(`${env.API_PREFIX}/ai`, aiRoutes);
app.use(`${env.API_PREFIX}`, analyticsRoutes);
app.use(`${env.API_PREFIX}/analytics`, analyticsRoutes);

// 9. 404 Catch-All Route
app.use('*', (req, res, next) => {
  next(ApiError.notFound(`Endpoint [${req.method}] ${req.originalUrl} not found on this server.`));
});

// 10. Global Error Handler
app.use(errorHandler);

export default app;
