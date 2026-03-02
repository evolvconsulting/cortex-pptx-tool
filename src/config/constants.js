/**
 * Constants for unit conversion and layout calculations
 */

module.exports = {
  // Unit conversion constants
  PT_PER_PX: 0.75,
  PX_PER_IN: 96,
  EMU_PER_IN: 914400,

  // Default slide dimensions (16:9 at 96 DPI)
  DEFAULT_WIDTH: 960,   // 10 inches
  DEFAULT_HEIGHT: 540,  // 5.625 inches

  // 4:3 layout height
  LAYOUT_4X3_HEIGHT: 720,  // 7.5 inches

  // Slide dimensions in inches (for scaling calculations)
  SLIDE_WIDTH_IN: 10,        // 16:9 width
  SLIDE_HEIGHT_IN: 5.625,    // 16:9 height
  SAFE_MARGIN: 0.2,          // Safety margin from edges
  MIN_SCALE: 0.5,            // Don't scale below 50%

  // Browser launch options
  BROWSER_ARGS: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],

  // Text element tags
  TEXT_TAGS: ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI'],
  
  // Extended text tags for flexible converter
  FLEX_TEXT_TAGS: ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'SPAN', 'LI']
};
