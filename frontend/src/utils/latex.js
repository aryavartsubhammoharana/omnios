/**
 * Precision Worldwide LaTeX & KaTeX Math Normalizer
 * Resolves:
 * - Markdown tables with inline math formulas
 * - Double-escaped backslashes (\\sim -> \sim, \\text -> \text)
 * - Trailing/stray $$ on variables (\phi$$, \nu$$, \omega=2rad s-1$$)
 * - Unbalanced or unclosed single/double dollar signs
 * - Safe Math Fraction, Radicals, and Greek Letter Isolation
 */
export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Strip outer double quotes if whole string was wrapped in quotes
  text = text.replace(/^"([\s\S]*)"$/, '$1');

  // 2. Normalize double-escaped LaTeX commands (e.g. \\lambda -> \lambda, \\sim -> \sim, \\text -> \text)
  text = text.replace(/\\\\(sim|approx|text|le|ge|pm|times|div|cdot|neq|leq|geq|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|sigma|phi|omega|Delta|Theta|Lambda|Sigma|Omega|frac|sqrt|int|sum|partial|nabla)/g, '\\$1');

  // 3. Normalize bracket delimiters
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, ' $$$1$$ ');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, ' $$$1$$ ');

  // 4. Fix AI stray $$ on expressions e.g. "(\lambda \sim 10^{-12}\text{ m}$$)" -> "($\lambda \sim 10^{-12}\text{ m}$)"
  text = text.replace(/([^\$])(\\[a-zA-Z]+[^\$\n]*?)\$\$/g, '$1$$$2$$');
  text = text.replace(/\$\$([^\$\n]+)\$\$/g, (m, inner) => {
    // If it is an inline expression without newlines, keep as $$ or $
    return `$$${inner}$$`;
  });

  // 5. Fix premature dollar sign closings before continuing LaTeX commands:
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z,;:!~]+[^\$\n.]+)/g, '$$$1 $2$$');

  // 6. Fix expressions starting with \lambda, \sim, 10^ without opening $:
  // e.g. "(\ \sim 10^{-12}\text{ m})" -> "($\sim 10^{-12}\text{ m}$)"
  text = text.replace(/(^|[\s\(])(\\(?:lambda|sim|approx|mu|nu|gamma|delta|theta|alpha|beta|omega|phi)\s*[^\$\n\)]+?)([\)\s,;:]|$)/g, (match, prefix, mathExpr, suffix) => {
    if (mathExpr.includes('$')) return match;
    return `${prefix}$${mathExpr.trim()}$${suffix}`;
  });

  // 7. Brace-Aware Math Wrapper for Greek letters & symbols
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g);
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0 && tokens[i]) {
      let part = tokens[i];

      // Wrap standalone fractions, square roots, integrals
      part = part.replace(/(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\})/g, '$$$1$$');
      part = part.replace(/(\\(?:sqrt|int|sum)\s*\{[^{}]*\})/g, '$$$1$$');
      
      const greekRegex = /^\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|hbar|infty|partial|nabla)(?:_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)*(?![a-zA-Z])/;
      
      let newPart = '';
      let braceDepth = 0;
      
      for (let j = 0; j < part.length; j++) {
         if (part[j] === '{') braceDepth++;
         else if (part[j] === '}') braceDepth = Math.max(0, braceDepth - 1);
         
         if (braceDepth === 0 && part[j] === '\\') {
            const remainder = part.slice(j);
            const match = remainder.match(greekRegex);
            if (match) {
               if (j === 0 || part[j-1] !== '\\') {
                  newPart += '$' + match[0] + '$';
                  j += match[0].length - 1;
                  continue;
               }
            }
         }
         newPart += part[j];
      }
      
      tokens[i] = newPart;
    }
  }
  text = tokens.join('');

  // 8. Clean duplicate dollar signs and fix trailing periods
  text = text.replace(/\$\s{1,}\$/g, ' ');
  text = text.replace(/\$\$\$+/g, '$$$$');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}
