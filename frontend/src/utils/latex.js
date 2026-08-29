/**
 * Worldwide Comprehensive LaTeX & KaTeX Math Normalizer
 * Handles:
 * - Standalone raw equations like \omega_{0}=\sqrt{\frac{k}{m}}=\sqrt{\frac{100}{1}}=10\,\text{rad s}^{-1}
 * - Formulas with math spacing commands (\,, \;, \!, \:, \quad, \qquad)
 * - Quoted equations ("...")
 * - Bracket delimiters (\[ \], \( \))
 * - Premature $ closings ($E_p=...$\omega t)
 * - Full Physics, Calculus, Chemistry, and Quantum syntax
 */
export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Strip outer double quotes if string was wrapped in quotes
  text = text.replace(/^"([\s\S]*)"$/, '$1');

  // 2. Normalize bracket math delimiters
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '$$$$$1$$$$');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, '$$$1$$');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // 3. Fix premature dollar sign closings before continuing LaTeX commands
  // e.g. "$... \cos^{2}$\omega t" -> "$... \cos^{2}\omega t$"
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z,;:!~]+[^\$\n.]+)/g, '$$$1 $2$$');

  // 4. Split by existing valid math delimiters ($$...$$ and $...$)
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g);

  for (let i = 0; i < tokens.length; i++) {
    // Only process text outside existing $ or $$ (even indices)
    if (i % 2 === 0 && tokens[i]) {
      let part = tokens[i];

      // If part contains ANY backslash command (\omega, \sqrt, \frac, \text, \, etc.)
      if (part.includes('\\')) {
        // Match complete mathematical clauses containing backslashes
        part = part.replace(/((?:[A-Za-z0-9_()+\-*/\^= ]*?\\[a-zA-Z,;:!~]+(?:\{[^}]*\}|\[[^}]*\]|[A-Za-z0-9_{}()+\-*/\^= \\,;:!~])*))/g, (m) => {
          let trimmed = m.trim();
          if (!trimmed) return m;

          // Extract leading plain English words before formula (e.g. "Given that " or "energy: ")
          let lead = '';
          let math = trimmed;
          const splitIdx = trimmed.search(/\\[a-zA-Z,;:!~]|[A-Za-z0-9_]+\s*=/);
          if (splitIdx > 0) {
            const potentialWords = trimmed.slice(0, splitIdx);
            if (!potentialWords.includes('\\')) {
              lead = potentialWords;
              math = trimmed.slice(splitIdx);
            }
          }

          // Strip trailing punctuation outside math
          let trail = '';
          if (math.endsWith('.') || math.endsWith(',') || math.endsWith(';') || math.endsWith('"')) {
            trail = math.slice(-1);
            math = math.slice(0, -1);
          }

          const cleanMath = math.replace(/\$/g, '').trim();
          if (!cleanMath) return m;

          return `${lead}$${cleanMath}$${trail}`;
        });
      }

      tokens[i] = part;
    }
  }

  text = tokens.join('');

  // 5. Clean up ONLY empty spaces between single dollars (never destroy $$)
  text = text.replace(/\$\s{1,}\$/g, ' ');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}
