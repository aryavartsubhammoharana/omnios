import { Router } from 'express';
import { DocumentController } from './document.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/rbac.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadNoteParamsSchema, documentParamsSchema } from './document.validation.js';

const router = Router();

router.use(authenticate);

// Upload classroom note (Teacher / Admin)
router.post(
  '/classrooms/:classroomId/notes',
  authorizeRoles('TEACHER', 'ADMIN'),
  validate(uploadNoteParamsSchema, 'params'),
  upload.single('file'),
  DocumentController.upload
);

// List classroom notes
router.get(
  '/classrooms/:classroomId/notes',
  validate(uploadNoteParamsSchema, 'params'),
  DocumentController.getByClassroom
);

// Get single note metadata and processing status
router.get(
  '/notes/:id',
  validate(documentParamsSchema, 'params'),
  DocumentController.getById
);

// Get parsed document chunks
router.get(
  '/notes/:id/chunks',
  validate(documentParamsSchema, 'params'),
  DocumentController.getChunks
);

// Delete note
router.delete(
  '/notes/:id',
  authorizeRoles('TEACHER', 'ADMIN'),
  validate(documentParamsSchema, 'params'),
  DocumentController.delete
);

export default router;
