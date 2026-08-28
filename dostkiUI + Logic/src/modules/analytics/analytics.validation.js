import { z } from 'zod';

export const trackViewSchema = z.object({
  timeSpentSeconds: z.number().int().min(0).max(86400).default(30),
});

export const classroomAnalyticsParamsSchema = z.object({
  id: z.string().uuid('Invalid classroom ID format'),
});

export const documentParamsSchema = z.object({
  id: z.string().uuid('Invalid document ID format'),
});
