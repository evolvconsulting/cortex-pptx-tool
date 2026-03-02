/**
 * Controllers Index - Export all controllers
 */

const { getHealth, VERSION } = require('./healthController');
const { convertSlides } = require('./convertController');

module.exports = {
  getHealth,
  convertSlides,
  VERSION
};
