/**
 * Dimension utilities for HTML/PPTX conversion
 */

const { PT_PER_PX, PX_PER_IN, EMU_PER_IN } = require('../config/constants');

/**
 * Get body dimensions from a Playwright page
 */
async function getBodyDimensions(page) {
  const bodyDimensions = await page.evaluate(() => {
    const body = document.body;
    const style = window.getComputedStyle(body);
    return {
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      scrollWidth: body.scrollWidth,
      scrollHeight: body.scrollHeight
    };
  });

  const errors = [];
  const widthOverflowPx = Math.max(0, bodyDimensions.scrollWidth - bodyDimensions.width - 1);
  const heightOverflowPx = Math.max(0, bodyDimensions.scrollHeight - bodyDimensions.height - 1);
  const widthOverflowPt = widthOverflowPx * PT_PER_PX;
  const heightOverflowPt = heightOverflowPx * PT_PER_PX;

  if (widthOverflowPt > 0 || heightOverflowPt > 0) {
    const directions = [];
    if (widthOverflowPt > 0) directions.push(`${widthOverflowPt.toFixed(1)}pt horizontally`);
    if (heightOverflowPt > 0) directions.push(`${heightOverflowPt.toFixed(1)}pt vertically`);
    errors.push(`HTML content overflows body by ${directions.join(' and ')}`);
  }

  return { ...bodyDimensions, errors };
}

/**
 * Validate HTML dimensions against presentation layout
 */
function validateDimensions(bodyDimensions, pres) {
  const errors = [];
  const widthInches = bodyDimensions.width / PX_PER_IN;
  const heightInches = bodyDimensions.height / PX_PER_IN;

  if (pres.presLayout) {
    const layoutWidth = pres.presLayout.width / EMU_PER_IN;
    const layoutHeight = pres.presLayout.height / EMU_PER_IN;

    if (Math.abs(layoutWidth - widthInches) > 0.1 || Math.abs(layoutHeight - heightInches) > 0.1) {
      errors.push(
        `HTML dimensions (${widthInches.toFixed(1)}" × ${heightInches.toFixed(1)}") ` +
        `don't match presentation layout (${layoutWidth.toFixed(1)}" × ${layoutHeight.toFixed(1)}")`
      );
    }
  }
  return errors;
}

/**
 * Calculate viewport dimensions based on layout
 */
function getViewportDimensions(layout, customWidth, customHeight) {
  const { DEFAULT_WIDTH, DEFAULT_HEIGHT, LAYOUT_4X3_HEIGHT } = require('../config/constants');
  
  let width = DEFAULT_WIDTH;
  let height = DEFAULT_HEIGHT;
  
  if (layout === 'LAYOUT_4x3') {
    height = LAYOUT_4X3_HEIGHT;
  }
  
  if (customWidth) width = customWidth;
  if (customHeight) height = customHeight;
  
  return { width, height };
}

module.exports = {
  getBodyDimensions,
  validateDimensions,
  getViewportDimensions
};
