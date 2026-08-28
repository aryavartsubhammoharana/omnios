import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from './env.js';

let s3Client = null;

if (env.STORAGE_DRIVER === 's3' && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

// Ensure local upload directory exists
const localUploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

export const storageService = {
  /**
   * Save uploaded file to storage (local disk or S3)
   * @param {Object} file Express Multer File
   * @returns {Promise<{ key: string, url: string, size: number, path?: string }>}
   */
  async save(file) {
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    if (s3Client && env.STORAGE_DRIVER === 's3') {
      const uploadParams = {
        Bucket: env.AWS_BUCKET_NAME,
        Key: `notes/${filename}`,
        Body: file.buffer || fs.createReadStream(file.path),
        ContentType: file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      const url = `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/notes/${filename}`;

      // Clean up temporary local file if multer saved to disk
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return {
        key: `notes/${filename}`,
        url,
        size: file.size,
      };
    }

    // Local Disk Fallback
    const destinationPath = path.join(localUploadDir, filename);

    if (file.buffer) {
      await fs.promises.writeFile(destinationPath, file.buffer);
    } else if (file.path && file.path !== destinationPath) {
      await fs.promises.copyFile(file.path, destinationPath);
      await fs.promises.unlink(file.path);
    }

    return {
      key: filename,
      url: `/uploads/${filename}`,
      size: file.size,
      localPath: destinationPath,
    };
  },

  /**
   * Read file content buffer from local disk or S3
   * @param {string} fileUrlOrKey 
   * @returns {Promise<Buffer>}
   */
  async getBuffer(fileUrlOrKey) {
    if (s3Client && env.STORAGE_DRIVER === 's3' && fileUrlOrKey.startsWith('notes/')) {
      const command = new GetObjectCommand({
        Bucket: env.AWS_BUCKET_NAME,
        Key: fileUrlOrKey,
      });
      const response = await s3Client.send(command);
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    }

    // Local file resolution with Path Traversal Protection
    let localPath = fileUrlOrKey;
    if (fileUrlOrKey.startsWith('/uploads/')) {
      localPath = path.join(localUploadDir, path.basename(fileUrlOrKey));
    } else if (!path.isAbsolute(fileUrlOrKey)) {
      localPath = path.join(localUploadDir, path.basename(fileUrlOrKey));
    }

    const resolved = path.resolve(localPath);
    if (!resolved.startsWith(path.resolve(localUploadDir))) {
      throw new Error('Access denied: Unauthorized directory traversal attempt detected');
    }

    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found on disk at path: ${resolved}`);
    }

    return fs.promises.readFile(resolved);
  },

  /**
   * Delete file from storage
   * @param {string} fileKeyOrUrl 
   */
  async delete(fileKeyOrUrl) {
    try {
      if (s3Client && env.STORAGE_DRIVER === 's3' && fileKeyOrUrl.startsWith('notes/')) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: env.AWS_BUCKET_NAME,
          Key: fileKeyOrUrl,
        }));
        return;
      }

      let localPath = fileKeyOrUrl;
      if (fileKeyOrUrl.startsWith('/uploads/')) {
        localPath = path.join(localUploadDir, path.basename(fileKeyOrUrl));
      } else if (!path.isAbsolute(fileKeyOrUrl)) {
        localPath = path.join(localUploadDir, path.basename(fileKeyOrUrl));
      }

      const resolved = path.resolve(localPath);
      if (!resolved.startsWith(path.resolve(localUploadDir))) {
        throw new Error('Access denied: Unauthorized directory traversal attempt detected');
      }

      if (fs.existsSync(resolved)) {
        await fs.promises.unlink(resolved);
      }
    } catch (err) {
      console.warn('⚠️ File deletion warning:', err.message);
    }
  }
};
