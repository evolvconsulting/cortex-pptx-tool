/**
 * Converters Index - Export all conversion functions
 */

const { html2pptxFromString } = require('./domParserConverter');
const { html2pptxScreenshot } = require('./screenshotConverter');
const { html2pptxFlexible } = require('./flexibleConverter');
const { addChartToSlide, processCharts } = require('./chartBuilder');
const { addTableToSlide, processTables } = require('./tableBuilder');

module.exports = {
  html2pptxFromString,
  html2pptxScreenshot,
  html2pptxFlexible,
  addChartToSlide,
  processCharts,
  addTableToSlide,
  processTables
};
