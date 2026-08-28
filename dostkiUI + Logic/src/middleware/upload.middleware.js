import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.jpeg', '.jpg', '.png', '.webp', '.bmp'];

// Multer Memory Storage (for seamless processing directly to S3 / disk)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);

  if (isMimeAllowed && isExtAllowed) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Unsupported or mismatched file format (extension: ${ext || 'none'}, mime: ${file.mimetype}). Allowed formats: PDF, DOCX, TXT, MD, PNG, JPG, WEBP`
      ),
      false
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, // 50MB
  },
  fileFilter,
});
