/**
 * Text Chunker utility for RAG vector pipelines
 * Splits documents into semantic chunks (approx. 500 - 1000 tokens) with overlap
 */

export class TextChunker {
  /**
   * Approximate token count (1 token ≈ 4 characters for English text)
   * @param {string} text 
   * @returns {number}
   */
  static estimateTokenCount(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Split text into overlapping chunks while preserving sentence/paragraph boundaries
   * @param {string} text - Raw input document text
   * @param {Object} options
   * @param {number} options.maxTokens - Target maximum tokens per chunk (default: 600 ≈ 2400 chars)
   * @param {number} options.overlapTokens - Token overlap between consecutive chunks (default: 80 ≈ 320 chars)
   * @param {Object} options.metadata - Base metadata to attach to each chunk
   * @returns {Array<{ chunkIndex: number, chunkText: string, tokenCount: number, metadata: object }>}
   */
  static splitText(text, options = {}) {
    const maxTokens = options.maxTokens || 600;
    const overlapTokens = options.overlapTokens || 80;
    const baseMetadata = options.metadata || {};

    const maxChars = maxTokens * 4;
    const overlapChars = overlapTokens * 4;

    if (!text || typeof text !== 'string') {
      return [];
    }

    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleanText.length <= maxChars) {
      return [
        {
          chunkIndex: 0,
          chunkText: cleanText,
          tokenCount: this.estimateTokenCount(cleanText),
          metadata: {
            ...baseMetadata,
            charStart: 0,
            charEnd: cleanText.length,
            totalChunks: 1,
          },
        },
      ];
    }

    // Split text into structural paragraphs first
    const paragraphs = cleanText.split(/\n\n+/);
    const rawBlocks = [];

    for (const para of paragraphs) {
      if (para.length <= maxChars) {
        rawBlocks.push(para);
      } else {
        // Para is too long: split into sentences
        const sentences = para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [para];
        for (const sentence of sentences) {
          if (sentence.length <= maxChars) {
            rawBlocks.push(sentence.trim());
          } else {
            // Very long sentence: slice into word chunks
            const words = sentence.split(/\s+/);
            let currentSlice = '';
            for (const word of words) {
              if ((currentSlice + ' ' + word).length <= maxChars) {
                currentSlice = currentSlice ? `${currentSlice} ${word}` : word;
              } else {
                if (currentSlice) rawBlocks.push(currentSlice);
                currentSlice = word;
              }
            }
            if (currentSlice) rawBlocks.push(currentSlice);
          }
        }
      }
    }

    // Combine blocks into windowed chunks with overlap
    const chunks = [];
    let currentChunk = '';
    let startCharIndex = 0;

    for (let i = 0; i < rawBlocks.length; i++) {
      const block = rawBlocks[i];
      const proposed = currentChunk ? `${currentChunk}\n\n${block}` : block;

      if (proposed.length <= maxChars) {
        currentChunk = proposed;
      } else {
        if (currentChunk) {
          const chunkStr = currentChunk.trim();
          chunks.push({
            chunkIndex: chunks.length,
            chunkText: chunkStr,
            tokenCount: this.estimateTokenCount(chunkStr),
            metadata: {
              ...baseMetadata,
              charStart: startCharIndex,
              charEnd: startCharIndex + chunkStr.length,
            },
          });
          startCharIndex += chunkStr.length;

          // Compute overlap for sliding window
          const words = chunkStr.split(/\s+/);
          const overlapWords = words.slice(-Math.floor(overlapChars / 5)).join(' ');
          currentChunk = overlapWords ? `${overlapWords}\n\n${block}` : block;
        } else {
          currentChunk = block;
        }
      }
    }

    // Add remaining chunk
    if (currentChunk && currentChunk.trim()) {
      const chunkStr = currentChunk.trim();
      chunks.push({
        chunkIndex: chunks.length,
        chunkText: chunkStr,
        tokenCount: this.estimateTokenCount(chunkStr),
        metadata: {
          ...baseMetadata,
          charStart: startCharIndex,
          charEnd: startCharIndex + chunkStr.length,
        },
      });
    }

    // Annotate totalChunks in all chunk metadata
    const total = chunks.length;
    return chunks.map((c) => ({
      ...c,
      metadata: {
        ...c.metadata,
        totalChunks: total,
      },
    }));
  }
}
