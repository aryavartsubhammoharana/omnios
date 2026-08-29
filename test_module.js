import { formatLatex } from './frontend/src/utils/latex.js';

const testCases = [
  // Issue 1: Fraction ParseError
  `\\omega = \\frac{\\nu}{2\\pi}`,
  // Issue 2: Sqrt internal gamma ParseError
  `\\omega_d = \\sqrt{\\omega_0^2 - \\gamma^2}`,
  // Issue 3: Stray $$
  `phase constant \\phi$$?`,
  `\\omega = 10\\text{rad/s}$$`,
  // Issue 4: Mixed prose and math
  `Both \\omega = 2\\pi\\nu and T = \\frac{2\\pi}{\\omega} are correct`
];

testCases.forEach((t, i) => {
  console.log(`--- TEST ${i+1} ---`);
  console.log("IN :", t);
  console.log("OUT:", formatLatex(t));
});
