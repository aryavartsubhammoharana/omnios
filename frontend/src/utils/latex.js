/**
 * Precision Worldwide LaTeX & KaTeX Math Normalizer
 * Resolves:
 * - Trailing/stray $$ on variables (\phi$$, \nu$$, \omega=2rad s-1$$)
 * - Standalone raw equations (\omega_0=\sqrt{...}=10\,\text{rad s}^{-1})
 * - Raw Greek letters (\phi, \gamma, \omega, \nu, \alpha, \beta, \theta, \pi)
 * - LaTeX math spacing commands (\,, \;, \!, \:, \quad, \qquad)
 * - Fractions, radicals, derivations, and energy equations
 */
export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Strip outer double quotes if string was wrapped in quotes
  text = text.replace(/^"([\s\S]*)"$/, '$1');

  // 2. Fix AI stray $$ on inline variables e.g. "\phi$$" -> "$\phi$", "\nu$$" -> "$\nu$", "s^{-1}$$" -> "s^{-1}$"
  text = text.replace(/([^\$])(\\[a-zA-Z]+)\$\$/g, '$1$$$2$$');
  text = text.replace(/([^\$])(\\[a-zA-Z]+[^\$\n]+?)\$\$/g, '$1$$$2$$');

  // 3. Normalize bracket delimiters
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, ' $$$1$$ ');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, ' $$$1$$ ');

  // 4. Fix premature dollar sign closings before continuing LaTeX commands:
  // e.g. "$... \cos^{2}$\omega t" -> "$... \cos^{2}\omega t$"
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z,;:!~]+[^\$\n.]+)/g, '$$$1 $2$$');

  // 5. Wrap raw standalone equations (lines containing \frac, \sqrt, \times, \cdot, =)
  const lines = text.split('\n');
  const mapped = lines.map((line) => {
    let l = line.trim();
    if (!l) return line;

    if (l.includes('\\frac') || l.includes('\\sqrt') || l.includes('\\times') || l.includes('\\cdot') || l.includes('\\cos') || l.includes('\\sin') || (l.includes('\\') && l.includes('='))) {
      if (!l.startsWith('$$') && !l.startsWith('$')) {
        l = l.replace(/((?:[A-Za-z0-9_()+\-*/\^= ]*?\\[a-zA-Z,;:!~]+(?:\{[^}]*\}|\[[^}]*\]|[A-Za-z0-9_{}()+\-*/\^= \\,;:!~])*))/g, (m) => {
          let trimmed = m.trim();
          if (!trimmed || trimmed.startsWith('$')) return m;

          let lead = '';
          let math = trimmed;
          const eqIdx = trimmed.search(/\\[a-zA-Z,;:!~]|[A-Za-z0-9_]+\s*=/);
          if (eqIdx > 0) {
            const prefix = trimmed.slice(0, eqIdx);
            if (!prefix.includes('\\')) {
              lead = prefix;
              math = trimmed.slice(eqIdx);
            }
          }

          let trail = '';
          if (math.endsWith('.') || math.endsWith(',') || math.endsWith(';') || math.endsWith(':')) {
            trail = math.slice(-1);
            math = math.slice(0, -1);
          }

          const cleanMath = math.replace(/\$/g, '').trim();
          if (!cleanMath) return m;

          return `${lead}$${cleanMath}$${trail}`;
        });
      }
    }

    return l;
  });

  text = mapped.join('\n');

  // 6. Wrap remaining standalone Greek letters or symbols NOT inside $...$
  text = text.replace(/(?<!\$)(?<!\\)(\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|hbar|infty|partial|nabla))(?![a-zA-Z0-9_])(?!\$)/g, '$$$1$$');

  // 7. Clean duplicate dollar signs
  text = text.replace(/\$\s{1,}\$/g, ' ');
  text = text.replace(/\$\$\$+/g, '$$$$');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}
