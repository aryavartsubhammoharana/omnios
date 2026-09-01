/**
 * Precision Worldwide LaTeX & KaTeX Math Normalizer
 * Resolves:
 * - Parentheses with LaTeX commands e.g. "(\lambda \sim 10^3\text{ m})" -> "($\lambda \sim 10^3\text{ m}$)"
 * - Stray trailing $$ e.g. "( \lambda \sim 10^{-12}\text{ m}$$)" -> "($\lambda \sim 10^{-12}\text{ m}$)"
 * - Double-escaped backslashes (\\lambda -> \lambda, \\sim -> \sim, \\text -> \text)
 * - Safe Math Fraction, Radicals, and Greek Letter Isolation
 * - Unbalanced or unclosed single/double dollar signs
 */
export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Strip outer double quotes if string was wrapped in quotes
  text = text.replace(/^"([\s\S]*)"$/, '$1');

  // 2. Normalize double-escaped LaTeX backslashes: \\lambda -> \lambda, \\left -> \left, \\frac -> \frac
  text = text.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // 3. Convert bracket delimiters \[ ... \] and \( ... \)
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, ' $$$1$$ ');

  // 4. Tokenize already delimited math ($$...$$ and $...$) so we don't double-wrap
  const mathTokens = [];
  text = text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    const idx = mathTokens.length;
    mathTokens.push(match);
    return `___MATH_DELIM_${idx}___`;
  });

  // 5. Intelligent detection and auto-wrapping of full un-delimited formulas and equations
  // e.g. "• JFET saturation current: I_D = I_{DSS}\left(1 - \frac{V_{GS}}{V_P}\right)^2"
  // e.g. "• BJT leakage relation: I_{CEO} = (\beta + 1)I_{CBO}"
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    if (line.includes('___MATH_DELIM_')) return line;

    if (/\\(?:left|right|frac|sqrt|beta|alpha|theta|pi|lambda|sigma|mu|Omega|Delta|sum|int|infty|times|cdot|partial)|[A-Za-z0-9]_[A-Za-z0-9\{\}]+/.test(line)) {
      let replaced = line.replace(/^(\s*(?:[\*\-\•]|\d+\.)\s*[^:\n]+:\s*)([A-Za-z0-9_\{\}\^\+\-\*\/\(\)\s\\=]+)(.*)$/g, (m, prefix, expr, suffix) => {
        const trimmed = expr.trim();
        if (trimmed && !trimmed.startsWith('$') && (trimmed.includes('\\') || trimmed.includes('_') || trimmed.includes('^') || trimmed.includes('='))) {
          const idx = mathTokens.length;
          mathTokens.push(`$${trimmed}$`);
          return `${prefix}___MATH_DELIM_${idx}___${suffix || ''}`;
        }
        return m;
      });

      if (replaced !== line) return replaced;

      replaced = line.replace(/([A-Za-z0-9_\{}\^]+\s*=\s*)?([A-Za-z0-9_\{}\^]*\\left[\(\[\{][\s\S]*?\\right[\)\]\}](?:\^[0-9\-\{\}]+)?)/g, (m, lhs, rhs) => {
        const fullExpr = ((lhs || '') + rhs).trim();
        const idx = mathTokens.length;
        mathTokens.push(`$${fullExpr}$`);
        return `___MATH_DELIM_${idx}___`;
      });

      if (replaced !== line) return replaced;
    }

    return line;
  });

  text = processedLines.join('\n');

  // 6. Fix parentheses containing LaTeX commands: "(\lambda \sim 10^3\text{ m})" -> "($\lambda \sim 10^3\text{ m}$)"
  text = text.replace(/\(\s*([^\$\n\(\)]*?\\[a-zA-Z]+[^\$\n\(\)]*?)\s*\)/g, (match, inner) => {
    const cleaned = inner.replace(/\$+/g, '').trim();
    return `($${cleaned}$)`;
  });

  // 7. Wrap standalone fractions, Greek letters, and sqrt/int/sum if still un-delimited
  text = text.replace(/(?<![\$\w])((\\frac\s*\{[^{}]*\}\s*\{[^{}]*\}|\\sqrt\s*\{[^{}]*\}|\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|hbar|infty|partial|nabla)(?:_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)*)(?![a-zA-Z]))(?![\$\w])/g, '$$$1$$');

  // 8. Restore protected math blocks
  mathTokens.forEach((m, idx) => {
    text = text.replace(`___MATH_DELIM_${idx}___`, m);
  });

  // 9. Clean duplicate dollar signs and trailing period collisions
  text = text.replace(/\${3,}/g, '$$');
  text = text.replace(/\$\s{1,}\$/g, ' ');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}
