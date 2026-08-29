const part = `$\\sqrt{\\omega_0^2 - \\gamma^2}$`;
let newPart = '';
let braceDepth = 0;

const greekRegex = /^\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|hbar|infty|partial|nabla)(?:_[a-zA-Z0-9]+|\\^[a-zA-Z0-9]+)*(?![a-zA-Z])/;

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

console.log("IN :", part);
console.log("OUT:", newPart);
