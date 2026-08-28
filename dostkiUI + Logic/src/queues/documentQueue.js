import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';

export const DOCUMENT_QUEUE_NAME = 'document-processing-queue';

export let documentQueue = null;

try {
  documentQueue = new Queue(DOCUMENT_QUEUE_NAME, {
    connection: redisConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  });

  documentQueue.on('error', () => {
    // Suppress unhandled queue connection spam when offline
  });
} catch (error) {
  // Graceful fallback
}

/**
 * Enqueue a document for asynchronous parsing, chunking, and embedding
 */
export const enqueueDocumentProcessing = async (data) => {
  if (documentQueue) {
    try {
      const job = await documentQueue.add('process-document', data, {
        jobId: `doc-${data.documentId}`,
      });
      return { queued: true, jobId: job.id };
    } catch (err) {
      // Fallback below
    }
  }

  // Fallback: direct background processing without blocking request
  import('./workers/fileProcessor.worker.js').then(({ processDocumentJobDirectly }) => {
    processDocumentJobDirectly(data).catch((err) => {
      console.error('❌ Direct file processing fallback error:', err);
    });
  });

  return { queued: true, jobId: `fallback-${Date.now()}` };
};
