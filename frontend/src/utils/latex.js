/**
 * Precision Worldwide LaTeX & KaTeX Math Normalizer
 * Resolves:
 * - Trailing/stray $$ on variables (\phi$$, \nu$$, \omega=2rad s-1$$)
 * - Safe Math Fraction & Radical Isolation (prevents \frac{\nu}{2\pi} breaking into \frac{$\nu$}{...})
 * - Brace-Aware Greek Letter Parsing (skips letters inside \sqrt{...} or \frac{...})
 * - Support for subscripts/superscripts on standalone variables (\omega_0, \gamma^2, \omega_d)
 */
export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Strip outer double quotes if string was wrapped in quotes
  text = text.replace(/^"([\s\S]*)"$/, '$1');

  // 2. Fix AI stray $$ on inline variables e.g. "\phi$$" -> "$\phi$"
  text = text.replace(/([^\$])(\\[a-zA-Z]+(?:_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)?)\$\$/g, '$1$$$2$$');
  text = text.replace(/([^\$])(\\[a-zA-Z]+[^\$\n]*?)\$\$/g, '$1$$$2$$');

  // 3. Normalize bracket delimiters
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, ' $$$1$$ ');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, ' $$$1$$ ');

  // 4. Fix premature dollar sign closings before continuing LaTeX commands:
  // e.g. "$... \cos^{2}$\omega t" -> "$... \cos^{2}\omega t$"
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z,;:!~]+[^\$\n.]+)/g, '$$$1 $2$$');

  // 5. Brace-Aware Math Wrapper
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g);
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0 && tokens[i]) {
      let part = tokens[i];

      // Wrap standalone fractions, square roots, integrals (without nested braces)
      part = part.replace(/(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\})/g, '$$$1$$');
      part = part.replace(/(\\(?:sqrt|int|sum)\s*\{[^{}]*\})/g, '$$$1$$');
      
      // BULLETPROOF: Wrap Greek letters (and their sub/superscripts) ONLY IF NOT inside { } blocks
      // This prevents KaTeX ParseErrors where $\gamma$ gets injected inside \sqrt{ \omega_0^2 - \gamma^2 }
      const greekRegex = /^\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|hbar|infty|partial|nabla)(?:_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)*(?![a-zA-Z])/;
      
      let newPart = '';
      let braceDepth = 0;
      
      for (let j = 0; j < part.length; j++) {
         if (part[j] === '{') braceDepth++;
         else if (part[j] === '}') braceDepth = Math.max(0, braceDepth - 1);
         
         // Only look for commands when outside of all brace blocks
         if (braceDepth === 0 && part[j] === '\\') {
            const remainder = part.slice(j);
            const match = remainder.match(greekRegex);
            if (match) {
               // Ensure it is not preceded by a backslash (i.e. not \\omega)
               if (j === 0 || part[j-1] !== '\\') {
                  newPart += '$' + match[0] + '$';
                  j += match[0].length - 1; // skip the matched greek letter and its modifiers
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

  // 6. Clean duplicate dollar signs
  text = text.replace(/\$\s{1,}\$/g, ' ');
  text = text.replace(/\$\$\$+/g, '$$$$');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}
