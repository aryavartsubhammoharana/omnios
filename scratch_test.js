function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;
  text = text.replace(/^"([\s\S]*)"$/, '$1');

  // Fix AI stray $$ on inline variables e.g. "\phi$$" -> "$\phi$"
  text = text.replace(/([^\$])(\\[a-zA-Z]+(?:_[a-zA-Z0-9]+|\^[a-zA-Z0-9]+)?)\$\$/g, '$1$$$2$$');
  text = text.replace(/([^\$])(\\[a-zA-Z]+[^\$\n]*?)\$\$/g, '$1$$$2$$');

  // Normalize bracket delimiters
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$$1$$$$\n\n');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, ' $$$1$$ ');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, ' $$$1$$ ');
  
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z,;:!~]+[^\$\n.]+)/g, '$$$1 $2$$');

  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g);
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0 && tokens[i]) {
      let part = tokens[i];

      // Wrap standalone fractions, square roots, integrals (without nested braces)
      part = part.replace(/(\\frac\s*\{[^{}]*\}\s*\{[^{}]*\})/g, '$$$1$$');
      part = part.replace(/(\\(?:sqrt|int|sum)\s*\{[^{}]*\})/g, '$$$1$$');
      
      // BULLETPROOF: Wrap Greek letters (and their sub/superscripts) ONLY IF NOT inside { } blocks
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

  text = text.replace(/\$\s{1,}\$/g, ' ');
  text = text.replace(/\$\$\$+/g, '$$$$');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}

const testCases = [
  `\\omega_d = \\sqrt{\\omega_0^2 - \\gamma^2}=\\sqrt{20^2 - 10^2}=\\sqrt{400 - 100}=\\sqrt{300}\\approx 17.32\\,\\text{rad s}^{-1}$$`,
  `Compare \\gamma with \\omega_0: - If \\gamma < \\omega_0 \\rightarrow underdamped.`,
  `\\omega = \\frac{\\nu}{2\\pi}`,
  `\\frac{\\gamma}{\\omega}`
];

testCases.forEach(t => {
  console.log("IN :\n", t);
  console.log("OUT:\n", formatLatex(t));
  console.log("----------------------");
});
