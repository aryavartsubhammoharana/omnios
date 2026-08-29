function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  text = text.replace(/^"([\s\S]*)"$/, '$1');

  // Fix AI stray $$ on inline variables e.g. "\phi$$" -> "$\phi$"
  text = text.replace(/([^\$])(\\[a-zA-Z]+)\$\$/g, '$1$$$2$$');
  text = text.replace(/([^\$])(\\[a-zA-Z]+[^\$\n]*?)\$\$/g, '$1$$$2$$');

  // Normalize bracket delimiters
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, ' $$$1$$ ');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, ' $$$1$$ ');

  // Fix premature dollar sign closings
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z,;:!~]+[^\$\n.]+)/g, '$$$1 $2$$');

  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g);
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0 && tokens[i]) {
      // 1. Wrap standalone fractions, square roots, integrals
      // Math expressions with braces. Match \frac{}{} or \sqrt{}
      tokens[i] = tokens[i].replace(/(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\})/g, '$$$1$$');
      tokens[i] = tokens[i].replace(/(\\(?:sqrt|int|sum)\s*\{[^{}]*\})/g, '$$$1$$');
      
      // 2. Wrap standalone Greek letters (ONLY if NOT preceded by { or followed by })
      tokens[i] = tokens[i].replace(/(?<!\\)(?<!\{)(\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|hbar|infty|partial|nabla))(?![a-zA-Z0-9_])(?!\}|\s*\})/g, '$$$1$$');
    }
  }
  text = tokens.join('');

  text = text.replace(/\$\s{1,}\$/g, ' ');
  text = text.replace(/\$\$\$+/g, '$$$$');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}

const testCases = [
  `\\omega = \\frac{\\nu}{2\\pi}`,
  `T = \\frac{\\omega}{2\\pi}`,
  `\\nu = \\frac{2\\pi}{\\omega}`,
  `Both \\omega = 2\\pi\\nu and T = \\frac{2\\pi}{\\omega} are correct`,
  `T = \\frac{1}{\\nu}`,
  `\\nu = \\frac{\\omega}{2\\pi} gives T = \\frac{2\\pi}{\\omega}`
];

testCases.forEach(t => {
  console.log("IN :", t);
  console.log("OUT:", formatLatex(t));
  console.log("----------------------");
});
