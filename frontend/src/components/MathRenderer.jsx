import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { formatLatex } from '../utils/latex';

/**
 * Universal Math Renderer Component
 * Renders worldwide LaTeX mathematical expressions, physics derivations,
 * fractions, Greek symbols, matrices, square roots, and formatting seamlessly.
 */
export default function MathRenderer({ content, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        output: 'html', // Render pure HTML only, eliminates MathML screen-reader duplicate text
        throwOnError: false,
        errorColor: '#f43f5e',
        strict: false
      });
    } catch (e) {
      console.warn('KaTeX auto-render notice:', e);
    }
  }, [content]);

  if (!content) return null;

  const processedText = formatLatex(content);

  return (
    <div
      ref={containerRef}
      className={`math-rendered-content ${className}`}
      dangerouslySetInnerHTML={{ __html: convertMarkdownToSafeHtml(processedText) }}
    />
  );
}

/**
 * Converts standard Markdown formatting (bold, italics, code, lists, linebreaks)
 * while preserving KaTeX math blocks intact.
 */
function convertMarkdownToSafeHtml(text) {
  if (!text) return '';

  // 1. Preserve math blocks by replacing with temporary tokens
  const mathTokens = [];
  let tokenized = text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
    const idx = mathTokens.length;
    mathTokens.push(match);
    return `___MATH_TOKEN_${idx}___`;
  });

  // 2. Escape HTML characters in non-math parts
  tokenized = tokenized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Headings
  tokenized = tokenized.replace(/^### (.*$)/gim, '<h3 class="text-xs font-bold text-indigo-300 mt-3 mb-1">$1</h3>');
  tokenized = tokenized.replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold text-indigo-200 mt-3 mb-1.5">$1</h2>');
  tokenized = tokenized.replace(/^# (.*$)/gim, '<h1 class="text-base font-bold text-white mt-4 mb-2 border-b border-slate-700 pb-1">$1</h1>');

  // 4. Bold & Italic & Code
  tokenized = tokenized.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-200">$1</strong>');
  tokenized = tokenized.replace(/\*([^*\n]+)\*/g, '<em class="italic text-slate-300">$1</em>');
  tokenized = tokenized.replace(/`([^`\n]+)`/g, '<code class="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');

  // 5. Lists (Bullets & Numbers)
  tokenized = tokenized.replace(/^[\*\-] (.*$)/gim, '<li class="text-slate-200 ml-4 list-disc my-0.5">$1</li>');
  tokenized = tokenized.replace(/^\d+\. (.*$)/gim, '<li class="text-slate-200 ml-4 list-decimal my-0.5">$1</li>');

  // 6. Paragraphs and linebreaks
  tokenized = tokenized.replace(/\n\n+/g, '<div class="my-2"></div>');
  tokenized = tokenized.replace(/\n/g, '<br/>');

  // 7. Restore math blocks
  mathTokens.forEach((mathStr, idx) => {
    tokenized = tokenized.replace(`___MATH_TOKEN_${idx}___`, mathStr);
  });

  return tokenized;
}
