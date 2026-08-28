import crypto from 'crypto';

// Characters excluding ambiguous 0, O, 1, I to avoid student confusion
const CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a random 6-character alphanumeric classroom code
 * @param {number} length Default: 6
 * @returns {string} e.g. "DSA101", "K7W9P2"
 */
export const generateClassroomCode = (length = 6) => {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    const index = bytes[i] % CHARACTERS.length;
    code += CHARACTERS[index];
  }
  return code;
};
