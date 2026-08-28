import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { OcrService } from './ocr.service.js';

export class TextExtractorService {
  /**
   * Extract text from various document formats
   * @param {Buffer} buffer File buffer
   * @param {string} fileType MIME type or extension (pdf, docx, image, txt)
   * @param {string} [fileName=''] Original file name
   * @returns {Promise<{ text: string, pageCount: number, metadata: object }>}
   */
  static async extract(buffer, fileType, fileName = '') {
    const normalizedType = fileType.toLowerCase();

    try {
      // 1. PDF Documents
      if (normalizedType.includes('pdf') || fileName.endsWith('.pdf')) {
        const data = await pdfParse(buffer);
        return {
          text: data.text ? data.text.trim() : '',
          pageCount: data.numpages || 1,
          metadata: {
            info: data.info || {},
            format: 'pdf',
          },
        };
      }

      // 2. Word DOCX Documents
      if (
        normalizedType.includes('word') ||
        normalizedType.includes('docx') ||
        fileName.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return {
          text: result.value ? result.value.trim() : '',
          pageCount: 1,
          metadata: {
            messages: result.messages || [],
            format: 'docx',
          },
        };
      }

      // 3. Images & Handwritten Scans (OCR)
      if (
        normalizedType.startsWith('image/') ||
        ['.png', '.jpg', '.jpeg', '.webp', '.bmp'].some((ext) => fileName.endsWith(ext))
      ) {
        const { text, confidence } = await OcrService.extractText(buffer);
        return {
          text,
          pageCount: 1,
          metadata: {
            format: 'image_ocr',
            ocrConfidence: confidence,
          },
        };
      }

      // 4. Plain Text / Markdown Fallback
      if (
        normalizedType.includes('text') ||
        fileName.endsWith('.txt') ||
        fileName.endsWith('.md') ||
        fileName.endsWith('.csv')
      ) {
        const text = buffer.toString('utf-8').trim();
        return {
          text,
          pageCount: 1,
          metadata: {
            format: 'plain_text',
          },
        };
      }

      // Default binary or unknown fallback: attempt utf8 text conversion
      const rawText = buffer.toString('utf-8').trim();
      return {
        text: rawText,
        pageCount: 1,
        metadata: {
          format: 'unknown_raw',
        },
      };
    } catch (error) {
      console.error(`❌ Error parsing document (${fileName}, ${fileType}):`, error);
      throw new Error(`Text extraction failed for ${fileName}: ${error.message}`);
    }
  }
}
