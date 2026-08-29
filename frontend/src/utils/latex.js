/**
 * Worldwide Comprehensive LaTeX & KaTeX Math Normalizer
 * Covers ALL mathematical expressions, Physics laws, Calculus,
 * Linear Algebra, Quantum Mechanics, Trigonometry, and Fractions worldwide.
 */

// Worldwide master list of all standard LaTeX math commands
const WORLDWIDE_LATEX_COMMANDS = [
  // Fractions & Binomials
  'frac', 'dfrac', 'tfrac', 'cfrac', 'over', 'binom',
  // Radicals & Powers
  'sqrt',
  // Greek Alphabet (Lower)
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
  'theta', 'vartheta', 'iota', 'kappa', 'varkappa', 'lambda', 'mu', 'nu',
  'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon',
  'phi', 'varphi', 'chi', 'psi', 'omega',
  // Greek Alphabet (Upper)
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  // Trigonometry & Hyperbolic
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'arccot',
  'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch',
  // Calculus, Limits & Integrals
  'int', 'iint', 'iiint', 'oint', 'sum', 'prod', 'coprod', 'lim', 'liminf', 'limsup',
  'partial', 'nabla', 'to', 'infty', 'ln', 'log', 'exp', 'det', 'dim', 'ker', 'hom',
  'deg', 'gcd', 'max', 'min', 'sup', 'inf', 'arg',
  // Operators & Relations
  'pm', 'mp', 'times', 'div', 'cdot', 'circ', 'bullet', 'star', 'ast',
  'cap', 'cup', 'setminus', 'subset', 'supset', 'subseteq', 'supseteq',
  'in', 'notin', 'ni', 'forall', 'exists', 'nexists',
  'approx', 'sim', 'simeq', 'cong', 'equiv', 'neq', 'leq', 'geq', 'll', 'gg',
  'propto', 'perp', 'parallel',
  'leftarrow', 'rightarrow', 'leftrightarrow', 'Leftarrow', 'Rightarrow', 'Leftrightarrow',
  // Physics & Quantum Mechanics
  'hbar', 'ell', 'Re', 'Im', 'vec', 'hat', 'bar', 'dot', 'ddot', 'dddot', 'tilde',
  'widehat', 'widetilde', 'overline', 'underline', 'overbrace', 'underbrace',
  'langle', 'rangle', 'vert', 'Vert', 'bra', 'ket', 'braket',
  // Brackets, Spacing & Fonts
  'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
  'text', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathscr', 'mathfrak', 'mathbb',
  'quad', 'qquad'
];

const MASTER_COMMAND_REGEX = new RegExp(`\\\\(?:${WORLDWIDE_LATEX_COMMANDS.join('|')})(?![a-zA-Z])`, 'g');
const HAS_LATEX_COMMAND = new RegExp(`\\\\(?:${WORLDWIDE_LATEX_COMMANDS.join('|')})(?![a-zA-Z])`);

export function formatLatex(content) {
  if (!content || typeof content !== 'string') return content || '';

  let text = content;

  // 1. Normalize bracket delimiters to standard KaTeX markdown math delimiters
  text = text.replace(/\\\\\[([\s\S]*?)\\\\\]/g, '$$$$$1$$$$');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  text = text.replace(/\\\\\(([\s\S]*?)\\\\\)/g, '$$$1$$');
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // 2. Fix spaces between adjacent commands e.g. \cos\omega -> \cos \omega, \sin\omega -> \sin \omega
  text = text.replace(/\\(cos|sin|tan|cot|sec|csc|sqrt|frac|times|cdot|pm|int|sum|partial)(\\[a-zA-Z]+)/g, '\\$1 $2');

  // 3. Fix fragmented equations where dollar signs closed prematurely before the end of the math expression:
  // e.g. "$E_p = \frac{1}{2} k x^2 = ... \cos^2$\omega t + \phi" -> "$E_p = \frac{1}{2} k x^2 = ... \cos^2 \omega t + \phi$"
  text = text.replace(/\$([^\$\n]+)\$(\s*\\[a-zA-Z]+[^\$\n.]+)/g, '$$$1 $2$$');

  // 4. Split text into existing math blocks ($...$ and $$...$$) and prose
  const tokens = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]*?\$)/g);

  for (let i = 0; i < tokens.length; i++) {
    // Only process text OUTSIDE of existing $ or $$ (even indices)
    if (i % 2 === 0 && tokens[i]) {
      let part = tokens[i];

      // If this part contains ANY worldwide LaTeX command:
      if (HAS_LATEX_COMMAND.test(part)) {
        // Auto-wrap math clauses that contain backslash commands, superscripts, subscripts, fractions, or equal signs
        part = part.replace(/((?:[A-Za-z0-9_()+\-*/\^= ]*?)(?:\\[a-zA-Z]+|\^\{?[0-9a-zA-Z+-]+\}?|_\{?[0-9a-zA-Z+-]+\}?)(?:\{[^}]*\}|\[[^}]*\]|[A-Za-z0-9_{}()+\-*/\^= \\])*)/g, (m) => {
          let trimmed = m.trim();
          if (!trimmed) return m;

          // Extract leading English text if present (e.g. "displacement is" or "Potential energy:")
          let lead = '';
          let math = trimmed;
          const wordMatch = trimmed.match(/^([A-Za-z\s]{4,}\b)\s*([A-Za-z0-9_()+\-*/\^=].*)$/);
          if (wordMatch && !HAS_LATEX_COMMAND.test(wordMatch[1])) {
            lead = wordMatch[1] + ' ';
            math = wordMatch[2];
          }

          // Strip trailing punctuation outside math
          let trail = '';
          if (math.endsWith('.') || math.endsWith(',') || math.endsWith(';')) {
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

  // 5. Clean up duplicate or broken delimiters
  text = text.replace(/\$\s*\$/g, ' ');
  text = text.replace(/\$\$\$+/g, '$$$$');
  text = text.replace(/\.\$\$/g, '$$$$.');
  text = text.replace(/\.\$/g, '$.');

  return text;
}
