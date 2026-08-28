import { createWorker } from 'tesseract.js';

export class OcrService {
  /**
   * Extract text from an image buffer or file path using Tesseract OCR
   * @param {Buffer | string} imageSource Buffer or file path of image
   * @param {string} [language='eng'] OCR Language
   * @returns {Promise<{ text: string, confidence: number }>}
   */
  static async extractText(imageSource, language = 'eng') {
    let worker = null;
    try {
      worker = await createWorker(language);
      const ret = await worker.recognize(imageSource);
      const text = ret.data.text ? ret.data.text.trim() : '';
      const confidence = ret.data.confidence || 0;
      return { text, confidence };
    } catch (error) {
      console.error('❌ OCR Processing Error:', error.message);
      throw new Error(`Failed to extract text via OCR: ${error.message}`);
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }
}
