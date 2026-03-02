/**
 * DOM Parser Converter - Strict HTML to native PPTX elements
 * Validates dimensions and doesn't support gradients
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchBrowser } = require('../utils/browser');
const { getBodyDimensions, validateDimensions } = require('../utils/dimensions');
const { extractSlideData } = require('./domExtractor');
const { addBackground, addElements } = require('./slideBuilder');

/**
 * Convert HTML string to PowerPoint slide with strict validation
 * 
 * @param {string} htmlContent - HTML content as string
 * @param {object} pres - PptxGenJS presentation instance
 * @param {object} options - Options
 * @returns {Promise<{slide, placeholders}>}
 */
async function html2pptxFromString(htmlContent, pres, options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html2pptx-'));
  const htmlPath = path.join(tmpDir, 'slide.html');

  try {
    fs.writeFileSync(htmlPath, htmlContent);

    const browser = await launchBrowser();
    let bodyDimensions;
    let slideData;
    const validationErrors = [];

    try {
      const page = await browser.newPage();
      await page.goto(`file://${htmlPath}`);

      bodyDimensions = await getBodyDimensions(page);
      await page.setViewportSize({
        width: Math.round(bodyDimensions.width),
        height: Math.round(bodyDimensions.height)
      });

      slideData = await extractSlideData(page);
    } finally {
      await browser.close();
    }

    // Collect validation errors
    if (bodyDimensions.errors?.length > 0) {
      validationErrors.push(...bodyDimensions.errors);
    }

    const dimensionErrors = validateDimensions(bodyDimensions, pres);
    if (dimensionErrors.length > 0) {
      validationErrors.push(...dimensionErrors);
    }

    if (slideData.errors?.length > 0) {
      validationErrors.push(...slideData.errors);
    }

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'));
    }

    const targetSlide = options.slide || pres.addSlide();
    await addBackground(slideData, targetSlide);
    addElements(slideData, targetSlide, pres);

    return { slide: targetSlide, placeholders: slideData.placeholders };

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[html2pptx] Failed to cleanup temp dir:', e.message);
    }
  }
}

module.exports = { html2pptxFromString };
