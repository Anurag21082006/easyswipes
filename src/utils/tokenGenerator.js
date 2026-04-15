/**
 * Token Generator Utility
 * Generates prefixed, alphanumeric tokens for Posters, Hunters, and Bounties.
 * Format: $PXXXXX$  |  $HXXXXX$  |  $BXXXXX$
 * where XXXXX = 5 uppercase alphanumeric characters
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TOKEN_LENGTH = 5;

/**
 * Core random string generator
 * @returns {string} 5-character uppercase alphanumeric string
 */
const randomSegment = () =>
  Array.from({ length: TOKEN_LENGTH }, () =>
    CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  ).join('');

/**
 * Generate a Poster token: $PXXXXX$
 */
const generatePosterToken = () => `$P${randomSegment()}$`;

/**
 * Generate a Hunter token: $HXXXXX$
 */
const generateHunterToken = () => `$H${randomSegment()}$`;

/**
 * Generate a Bounty ID: $BXXXXX$
 */
const generateBountyId = () => `$B${randomSegment()}$`;

module.exports = {
  generatePosterToken,
  generateHunterToken,
  generateBountyId,
};
