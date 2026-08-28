import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  API_PREFIX: z.string().default('/api/v1'),
  CLIENT_URL: z.string().default('http://localhost:3000'),

  // PostgreSQL Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432').transform((val) => parseInt(val, 10)),
  DB_NAME: z.string().default('note_ai_db'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DATABASE_URL: z.string().optional(),
  DB_POOL_MAX: z.string().default('20').transform((val) => parseInt(val, 10)),
  DB_POOL_IDLE_TIMEOUT_MS: z.string().default('30000').transform((val) => parseInt(val, 10)),

  // Redis & BullMQ
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().optional(),

  // JWT & Auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('super_secret_jwt_access_key_change_in_production_32_chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters').default('super_secret_jwt_refresh_key_change_in_production_32_chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('super_secret_cookie_parser_signing_key_32_chars'),

  // AI & Embeddings
  AI_PROVIDER: z.enum(['openai', 'gemini', 'mock']).default('openai'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  GEMINI_API_KEY: z.string().optional().default(''),
  EMBEDDING_DIMENSION: z.string().default('1536').transform((val) => parseInt(val, 10)),

  // File Storage
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.string().default('50').transform((val) => parseInt(val, 10)),

  // AWS S3
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_BUCKET_NAME: z.string().default('note-ai-uploads'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('500').transform((val) => parseInt(val, 10))
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment configuration error:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
