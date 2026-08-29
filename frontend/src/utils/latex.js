/**
 * Utility to normalize all forms of LaTeX math into standard Markdown $ ... $ and $$ ... $$
 * so remark-math and rehype-katex render them perfectly.
 */
export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Normalize escaped backslashes in JSON strings: \\( or \\[
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '$$$$$1$$$$');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, '$$$1$$');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // 2. Catch expressions inside parentheses that contain LaTeX commands
  // e.g., (m=0.20,\text{kg}) or (\omega_d) or (2.5\times 10^{-2}) or (\phi= -\pi/2)
  text = text.replace(/\(([^)]*?\\[a-zA-Z_]+[^)]*?)\)/g, (match, inner) => {
    // If already enclosed in $, don't double wrap
    if (inner.startsWith('$') && inner.endsWith('$')) return inner;
    return `$${inner}$`;
  });

  // 3. Catch standalone unescaped LaTeX symbols or commands (e.g. \sqrt{...} or \frac{...}{...} or \omega_0)
  // that are NOT already surrounded by $
  // Match formulas with Greek letters, fractions, square roots, subscripts, superscripts
  const standaloneMathRegex = /(?<!\$)(?<!\w)(\\(?:frac|sqrt|times|cdot|pm|mp|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|chi|psi|omega|Delta|Gamma|Theta|Lambda|Sigma|Phi|Psi|Omega|partial|nabla|int|sum|prod|approx|neq|leq|geq|infty|hbar|text)(?:\{[^}]*\}|\[[^}]*\]|_[a-zA-Z0-9{}]|\^[a-zA-Z0-9{}]|[a-zA-Z0-9\s,./=+-])*?)(?!\$)(?!\w)/g;

  // 4. Ensure fractions and equations with / like (r/2m)^2 or 2/2 inside LaTeX context render cleanly
  return text;
}
