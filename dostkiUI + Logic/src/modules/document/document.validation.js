import { z } from 'zod';

export const uploadNoteParamsSchema = z.object({
  classroomId: z.string().uuid('Invalid classroom ID format'),
});

export const documentParamsSchema = z.object({
  id: z.string().uuid('Invalid document ID format'),
});
