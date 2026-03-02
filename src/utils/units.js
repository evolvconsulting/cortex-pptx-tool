/**
 * Utility functions for unit conversion and color handling
 */

const { PT_PER_PX, PX_PER_IN } = require('../config/constants');

/**
 * Convert pixels to inches
 */
function pxToInch(px) {
  return px / PX_PER_IN;
}

/**
 * Convert pixel string to points
 */
function pxToPoints(pxStr) {
  return parseFloat(pxStr) * PT_PER_PX;
}

/**
 * Convert RGB/RGBA string to hex color
 */
function rgbToHex(rgbStr) {
  if (rgbStr === 'rgba(0, 0, 0, 0)' || rgbStr === 'transparent') return 'FFFFFF';
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return 'FFFFFF';
  return match.slice(1).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

/**
 * Extract transparency from RGBA string
 */
function extractAlpha(rgbStr) {
  const match = rgbStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!match || !match[4]) return null;
  return Math.round((1 - parseFloat(match[4])) * 100);
}

/**
 * Apply CSS text-transform to text
 */
function applyTextTransform(text, textTransform) {
  if (textTransform === 'uppercase') return text.toUpperCase();
  if (textTransform === 'lowercase') return text.toLowerCase();
  if (textTransform === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase());
  return text;
}

module.exports = {
  pxToInch,
  pxToPoints,
  rgbToHex,
  extractAlpha,
  applyTextTransform
};
