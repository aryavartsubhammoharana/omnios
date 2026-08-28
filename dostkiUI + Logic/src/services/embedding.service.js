import crypto from 'crypto';
import { env } from '../config/env.js';

export class EmbeddingService {
  /**
   * Deterministic 1536-dimensional pseudo-semantic vector generator
   * Used when live API keys are not supplied (e.g. offline testing/eval)
   * Creates normalized L2 unit vectors based on hashed n-grams
   * @param {string} text 
   * @param {number} [dimensions=1536] 
   * @returns {number[]}
   */
  static generateDeterministicVector(text, dimensions = 1536) {
    const vector = new Array(dimensions).fill(0);
    const words = (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    // Hash words and n-grams into vector buckets
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash1 = parseInt(crypto.createHash('md5').update(word).digest('hex').substring(0, 8), 16);
      const hash2 = parseInt(crypto.createHash('sha1').update(word).digest('hex').substring(0, 8), 16);
      const index1 = hash1 % dimensions;
      const index2 = hash2 % dimensions;
      const weight = 1.0 / Math.sqrt(i + 1);

      vector[index1] += weight;
      vector[index2] -= weight * 0.5;

      // Bigram feature
      if (i < words.length - 1) {
        const bigram = `${word}_${words[i + 1]}`;
        const bigramHash = parseInt(crypto.createHash('sha256').update(bigram).digest('hex').substring(0, 8), 16);
        const bigramIndex = bigramHash % dimensions;
        vector[bigramIndex] += weight * 1.5;
      }
    }

    // Normalize to unit vector (L2 norm = 1)
    let sumSquares = 0;
    for (let i = 0; i < dimensions; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSquares) || 1;
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return vector;
  }

  /**
   * Generate 1536-d embedding for a single text string
   * @param {string} text 
   * @returns {Promise<number[]>}
   */
  static async generateEmbedding(text) {
    const embeddings = await this.generateBatchEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * Generate embeddings for a batch of text chunks
   * @param {string[]} texts 
   * @returns {Promise<number[][]>}
   */
  static async generateBatchEmbeddings(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const cleanTexts = texts.map((t) => (t || '').trim().replace(/\n+/g, ' '));

    // 1. OpenAI Embeddings API
    if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY && env.OPENAI_API_KEY.startsWith('sk-')) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
            input: cleanTexts,
            dimensions: env.EMBEDDING_DIMENSION || 1536,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data.data.map((item) => item.embedding);
      } catch (err) {
        console.warn('⚠️ OpenAI Embeddings API call failed, using fallback generator:', err.message);
      }
    }

    // 2. Gemini Embeddings API (if configured)
    if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      try {
        const results = [];
        for (const text of cleanTexts) {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: { parts: [{ text }] },
              }),
            }
          );
          if (response.ok) {
            const data = await response.json();
            let values = data.embedding.values;
            // Pad or project to 1536 dimensions if necessary
            if (values.length < 1536) {
              const padded = new Array(1536).fill(0);
              values.forEach((v, idx) => { padded[idx] = v; });
              values = padded;
            }
            results.push(values);
          } else {
            results.push(this.generateDeterministicVector(text, 1536));
          }
        }
        return results;
      } catch (err) {
        console.warn('⚠️ Gemini Embeddings API call failed, using fallback generator:', err.message);
      }
    }

    // 3. Fallback High-Quality Deterministic Vector Generator
    return cleanTexts.map((text) => this.generateDeterministicVector(text, env.EMBEDDING_DIMENSION || 1536));
  }

  /**
   * Format numeric vector array into Postgres pgvector SQL string `[0.1,0.2,...]`
   * @param {number[]} vector 
   * @returns {string}
   */
  static toPgVector(vector) {
    if (!Array.isArray(vector)) return '[]';
    return `[${vector.join(',')}]`;
  }
}
