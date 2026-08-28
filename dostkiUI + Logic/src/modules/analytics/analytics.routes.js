import { Router } from 'express';
import { AnalyticsController } from './analytics.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  trackViewSchema,
  documentParamsSchema,
  classroomAnalyticsParamsSchema,
} from './analytics.validation.js';

const router = Router();

router.use(authenticate);

// Student tracks note view time & daily streak
router.post(
  '/notes/:id/track-view',
  validate(documentParamsSchema, 'params'),
  validate(trackViewSchema, 'body'),
  AnalyticsController.trackView
);

// Teacher classroom analytics dashboard
router.get(
  '/classrooms/:id/analytics',
  authorizeRoles('TEACHER', 'ADMIN'),
  validate(classroomAnalyticsParamsSchema, 'params'),
  AnalyticsController.getClassroomAnalytics
);

// Current user streak info
router.get('/streak', AnalyticsController.getStreak);

export default router;
