import { z } from 'zod';

export const createClassroomSchema = z.object({
  name: z.string().min(2, 'Classroom name must be at least 2 characters').max(255),
  subject: z.string().min(2, 'Subject must be at least 2 characters').max(150),
  description: z.string().max(1000).optional().default(''),
});

export const joinClassroomSchema = z.object({
  classroomCode: z
    .string()
    .length(6, 'Classroom code must be exactly 6 characters')
    .toUpperCase(),
});

export const updateClassroomSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  subject: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional(),
});
