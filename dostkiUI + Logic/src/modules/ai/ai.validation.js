import { z } from 'zod';

export const chatSchema = z.object({
  classroomId: z.string().uuid('Invalid classroom ID format'),
  query: z.string().min(2, 'Query must be at least 2 characters long').max(2000),
  documentId: z.string().uuid('Invalid document ID format').optional(),
  topK: z.number().int().min(1).max(15).optional().default(4),
});

export const summarizeSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
});

export const generateQuizSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format'),
  numQuestions: z.number().int().min(1).max(20).optional().default(5),
});

export const explainSchema = z.object({
  classroomId: z.string().uuid('Invalid classroom ID format'),
  topic: z.string().min(2, 'Topic must be at least 2 characters long').max(500),
});
