import { Router } from 'express';
import { AiController } from './ai.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { chatSchema, summarizeSchema, generateQuizSchema } from './ai.validation.js';

const router = Router();

router.use(authenticate);

// RAG semantic search & Q&A
router.post('/chat', validate(chatSchema), AiController.chat);

// Document summarization & key takeaways
router.post('/summarize', validate(summarizeSchema), AiController.summarize);

// Interactive quiz & evaluation key generation
router.post('/generate-quiz', validate(generateQuizSchema), AiController.generateQuiz);

export default router;
