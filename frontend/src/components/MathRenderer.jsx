import React, { useEffect, useRef } from 'react';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';
import { formatLatex } from '../utils/latex';

/**
 * Universal Math & Markdown Table Renderer Component
 * Renders:
 * - Rich GFM Markdown Tables with responsive dark-mode styling
 * - Worldwide LaTeX mathematical expressions ($...$, $$...$$, \[...\], \(...\))
 * - Headings, bold, italic, code, lists, blockquotes, and paragraphs
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
        output: 'html',
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
 * Converts Markdown formatting (Tables, Headings, Bold, Lists, Code)
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

  // 2. Escape HTML special characters in non-math parts
  tokenized = tokenized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Parse Markdown Tables (| Col 1 | Col 2 |)
  tokenized = parseMarkdownTables(tokenized);

  // 4. Headings
  tokenized = tokenized.replace(/^### (.*$)/gim, '<h3 class="text-xs font-bold text-indigo-300 mt-3 mb-1">$1</h3>');
  tokenized = tokenized.replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold text-indigo-200 mt-3 mb-1.5">$1</h2>');
  tokenized = tokenized.replace(/^# (.*$)/gim, '<h1 class="text-base font-bold text-white mt-4 mb-2 border-b border-slate-700 pb-1">$1</h1>');

  // 5. Bold & Italic & Inline Code
  tokenized = tokenized.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-200">$1</strong>');
  tokenized = tokenized.replace(/\*([^*\n]+)\*/g, '<em class="italic text-slate-300">$1</em>');
  tokenized = tokenized.replace(/`([^`\n]+)`/g, '<code class="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');

  // 6. Lists (Bullets & Numbers) - ignore lines inside already formed HTML tables
  const lines = tokenized.split('\n');
  const formattedLines = [];
  let inHtmlBlock = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.includes('<div class="table-container') || line.includes('<table')) {
      inHtmlBlock = true;
    }
    if (line.includes('</table></div>')) {
      inHtmlBlock = false;
      formattedLines.push(line);
      continue;
    }

    if (!inHtmlBlock) {
      if (/^[\*\-] (.*$)/.test(line)) {
        line = line.replace(/^[\*\-] (.*$)/, '<li class="text-slate-200 ml-4 list-disc my-0.5">$1</li>');
      } else if (/^\d+\. (.*$)/.test(line)) {
        line = line.replace(/^\d+\. (.*$)/, '<li class="text-slate-200 ml-4 list-decimal my-0.5">$1</li>');
      }
    }
    formattedLines.push(line);
  }
  tokenized = formattedLines.join('\n');

  // 7. Paragraphs and linebreaks (avoid breaking HTML table tags)
  tokenized = tokenized.replace(/\n\n+/g, '<div class="my-2"></div>');
  
  // Replace remaining newlines with <br/> except around HTML block elements
  tokenized = tokenized.replace(/\n(?!(?:<\/table>|<\/div>|<div|<\/tbody>|<\/thead>|<tr|<\/tr>|<table))/gi, '<br/>');

  // 8. Restore KaTeX math blocks
  mathTokens.forEach((mathStr, idx) => {
    tokenized = tokenized.replace(`___MATH_TOKEN_${idx}___`, mathStr);
  });

  return tokenized;
}

/**
 * Robust GFM Markdown Table Parser
 * Converts Markdown tables into sleek, responsive HTML tables with dark-mode Tailwind classes.
 */
function parseMarkdownTables(text) {
  const lines = text.split('\n');
  const output = [];
  let tableRows = [];

  const isTableRow = (line) => {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
  };

  const isSeparatorRow = (line) => {
    const trimmed = line.trim();
    return /^\|(\s*[:-]+[-| :]*)\|$/.test(trimmed);
  };

  const renderTable = (rows) => {
    if (rows.length === 0) return '';

    let headerRow = null;
    let bodyRows = [];
    let hasSeparator = false;

    for (let i = 0; i < rows.length; i++) {
      if (isSeparatorRow(rows[i])) {
        hasSeparator = true;
        if (i > 0) {
          headerRow = rows[i - 1];
          bodyRows = rows.slice(i + 1);
        }
        break;
      }
    }

    if (!hasSeparator) {
      headerRow = rows[0];
      bodyRows = rows.slice(1);
    }

    const parseCells = (rowStr) => {
      return rowStr
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
    };

    let html = '<div class="table-container overflow-x-auto my-3 rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/20">';
    html += '<table class="min-w-full divide-y divide-slate-800 text-xs border-collapse">';

    // Thead
    if (headerRow) {
      const headers = parseCells(headerRow);
      html += '<thead class="bg-indigo-950/70 border-b border-indigo-800/80 text-indigo-200"><tr>';
      headers.forEach((h) => {
        html += `<th class="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[11px] border-r border-indigo-900/40 last:border-r-0">${h}</th>`;
      });
      html += '</tr></thead>';
    }

    // Tbody
    html += '<tbody class="divide-y divide-slate-800/70 bg-slate-900/40">';
    bodyRows.forEach((rowStr) => {
      if (!isSeparatorRow(rowStr)) {
        const cells = parseCells(rowStr);
        html += '<tr class="hover:bg-slate-800/50 transition duration-150">';
        cells.forEach((cell) => {
          html += `<td class="px-4 py-2 text-slate-200 border-r border-slate-800/50 last:border-r-0 leading-relaxed">${cell}</td>`;
        });
        html += '</tr>';
      }
    });
    html += '</tbody></table></div>';

    return html;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTableRow(line)) {
      tableRows.push(line);
    } else {
      if (tableRows.length > 0) {
        output.push(renderTable(tableRows));
        tableRows = [];
      }
      output.push(line);
    }
  }

  if (tableRows.length > 0) {
    output.push(renderTable(tableRows));
  }

  return output.join('\n');
}
