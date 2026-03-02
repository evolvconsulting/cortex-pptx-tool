/**
 * Icon utilities - Convert React icons to PNG
 */

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');

/**
 * Render a React icon component to base64 PNG
 * @param {Function} IconComponent - React icon component
 * @param {string} color - Icon color (default: '#000000')
 * @param {number} size - Icon size in pixels (default: 256)
 * @returns {Promise<string>} Base64 PNG with data URI prefix
 */
async function iconToBase64Png(IconComponent, color = '#000000', size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + pngBuffer.toString('base64');
}

/**
 * Load available react-icons sets
 */
function loadReactIcons() {
  const icons = {};
  const sets = ['fa', 'md', 'hi', 'bi', 'ai', 'fi'];
  
  for (const set of sets) {
    try {
      icons[set] = require(`react-icons/${set}`);
    } catch (e) {
      // Icon set not available
    }
  }
  
  return icons;
}

module.exports = {
  iconToBase64Png,
  loadReactIcons
};
