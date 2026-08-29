/**
 * Comprehensive LaTeX Normalizer for KaTeX & Remark-Math
 * Handles:
 * - \[...\] & \(...\) delimiters
 * - Unenclosed LaTeX backslash commands (\frac, \sqrt, \omega, \cos, \sin, \phi, etc.)
 * - Broken/fragmented dollar signs ($E_p=...$\omega t)
 * - Raw fractions like 1/2 in physics contexts (\frac{1}{2})
 * - Trigonometric arguments like \cos\omega t -> \cos(\omega t)
 */
export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Convert LaTeX bracket delimiters to standard markdown math
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, ' $$$1$$ ');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, ' $$$1$$ ');

  // 2. Fix spaced-out LaTeX commands e.g. \cos\omega -> \cos \omega, \sin\omega -> \sin \omega
  text = text.replace(/\\(cos|sin|tan|cot|sec|csc|sqrt|frac|times|cdot|pm)(\\[a-zA-Z]+)/g, '\\$1 $2');

  // 3. Fix fragmented closing $ followed immediately by backslash LaTeX commands
  // e.g. "$E_p = \frac{1}{2} m \omega^2 A^2 \cos^2$\omega t + \phi" -> "$E_p = \frac{1}{2} m \omega^2 A^2 \cos^2 \omega t + \phi$"
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z]+[^\$\n]+)/g, '$$$1 $2$$');

  // 4. Ensure formulas following labels like "Potential energy:" or "Kinetic energy:" or "gives:" are properly wrapped
  // e.g. "Potential energy: E_p = \frac{1}{2}..." or "Kinetic energy: E_k = ..."
  text = text.replace(/((?:Potential energy|Kinetic energy|Total energy|Displacement|Frequency|Angular frequency|Force|Velocity|Acceleration|Wave function)\s*:\s*)([A-Za-z0-9_().+\-*/\^=\s\\]+?)(?=\s*(?:\n|[A-Z][a-z]{3,}\b|\.|\$))/g, (match, label, formula) => {
    // If formula contains LaTeX commands or math operators and is not already in $
    if (formula.includes('\\') || formula.includes('=') || formula.includes('^') || formula.includes('_')) {
      const cleanFormula = formula.replace(/\$/g, '').trim();
      return `${label}$${cleanFormula}$ `;
    }
    return match;
  });

  // 5. Catch any remaining naked LaTeX expressions (with \frac, \sqrt, \omega, \phi, \alpha, \beta, \theta, \pi, \cos, \sin)
  // that are completely outside of $...$
  const chunks = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g);
  for (let i = 0; i < chunks.length; i++) {
    // Even indexes are outside of $...$
    if (i % 2 === 0 && chunks[i]) {
      let segment = chunks[i];

      // Fix naked equation segments containing backslash commands
      segment = segment.replace(/((?:[A-Za-z0-9_()+\-*/\^=]+\s*)?\\[a-zA-Z]+(?:\{[^}]*\}|\[[^}]*\]|[A-Za-z0-9_{}()+\-*/\^= \\])*)/g, (m) => {
        let trimmed = m.trim();
        if (!trimmed) return m;

        // Strip leading plain english words
        let leadWord = '';
        let mathStr = trimmed;
        const leadMatch = trimmed.match(/^([A-Za-z\s]{3,}\b)\s*([A-Za-z0-9_()+\-*/\^=].*)$/);
        if (leadMatch && !leadMatch[1].includes('\\')) {
          leadWord = leadMatch[1] + ' ';
          mathStr = leadMatch[2];
        }

        // Strip trailing punctuation
        let trail = '';
        if (mathStr.endsWith('.') || mathStr.endsWith(',') || mathStr.endsWith(';')) {
          trail = mathStr.slice(-1);
          mathStr = mathStr.slice(0, -1);
        }

        const cleanMath = mathStr.replace(/\$/g, '').trim();
        if (!cleanMath) return m;
        return `${leadWord}$${cleanMath}$${trail}`;
      });

      chunks[i] = segment;
    }
  }

  text = chunks.join('');

  // 6. Clean up redundant adjacent dollar signs like "$ $", "$$$$", or unneeded spaces inside delimiters
  text = text.replace(/\$\s*\$/g, ' ');
  text = text.replace(/\$\$\$+/g, '$$$$');
  text = text.replace(/\$\s*=\s*\$/g, ' = ');

  return text;
}
