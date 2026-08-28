import { Router } from 'express';
import { ClassroomController } from './classroom.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createClassroomSchema, joinClassroomSchema } from './classroom.validation.js';

const router = Router();

router.use(authenticate);

// Teacher creates classroom
router.post(
  '/',
  authorizeRoles('TEACHER', 'ADMIN'),
  validate(createClassroomSchema),
  ClassroomController.create
);

// Student joins classroom with 6-char code
router.post(
  '/join',
  authorizeRoles('STUDENT', 'FREE_USER', 'ADMIN'),
  validate(joinClassroomSchema),
  ClassroomController.join
);

// List user classrooms
router.get('/', ClassroomController.getAll);

// Single classroom details
router.get('/:id', ClassroomController.getById);

// Classroom members roster
router.get('/:id/members', ClassroomController.getMembers);

// Delete classroom
router.delete('/:id', authorizeRoles('TEACHER', 'ADMIN'), ClassroomController.delete);

export default router;
