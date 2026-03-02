/**
 * Flexible Converter - Tolerant HTML to PPTX conversion
 * Full feature support including inline formatting, shadows, rotation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchBrowser, navigateToFile, captureScreenshot, hasGradientBackground } = require('../utils/browser');
const { extractSlideData, scaleElementsToFit } = require('./domExtractor');
const { addImageBackground, addElements, addBackground } = require('./slideBuilder');
const { DEFAULT_WIDTH, DEFAULT_HEIGHT, SLIDE_WIDTH_IN, SLIDE_HEIGHT_IN, SAFE_MARGIN, MIN_SCALE } = require('../config/constants');

/**
 * Convert HTML to PPTX with flexible/tolerant mode
 * - Handles CSS gradients by capturing background as image
 * - Auto-scales content to match presentation layout
 * - Extracts native editable text elements with full formatting support
 * 
 * @param {string} htmlContent - HTML content as string
 * @param {object} pres - PptxGenJS presentation instance
 * @param {object} options - Options (width, height in pixels)
 * @returns {Promise<{slide, screenshotBase64, elementCount}>}
 */
async function html2pptxFlexible(htmlContent, pres, options = {}) {
  const targetWidth = options.width || DEFAULT_WIDTH;
  const targetHeight = options.height || DEFAULT_HEIGHT;
  
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html2pptx-flex-'));
  const htmlPath = path.join(tmpDir, 'slide.html');

  try {
    fs.writeFileSync(htmlPath, htmlContent);

    const browser = await launchBrowser();
    let slideData;
    let backgroundBase64 = null;
    let hasGradient = false;
    let screenshotBase64 = null;

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: targetWidth, height: targetHeight });
      await navigateToFile(page, htmlPath);

      // Check for gradient background
      hasGradient = await hasGradientBackground(page);

      // Capture background if gradient
      if (hasGradient) {
        console.log('[html2pptx-flex] Gradient detected - capturing background as image');
        backgroundBase64 = await captureScreenshot(page);
      }

      // Capture screenshot for preview
      screenshotBase64 = await captureScreenshot(page);

      // Extract full slide data with all formatting support
      slideData = await extractSlideData(page);
      
      // Log any validation errors
      if (slideData.errors && slideData.errors.length > 0) {
        console.warn('[html2pptx-flex] Validation warnings:', slideData.errors);
      }

    } finally {
      await browser.close();
    }

    // Scale elements to fit within slide boundaries if overflow detected
    const { elements: scaledElements, scale, wasScaled } = scaleElementsToFit(
      slideData.elements,
      SLIDE_WIDTH_IN,
      SLIDE_HEIGHT_IN,
      { margin: SAFE_MARGIN, minScale: MIN_SCALE, scaleFonts: true }
    );
    
    if (wasScaled) {
      slideData.elements = scaledElements;
      console.log(`[html2pptx-flex] Applied ${(scale * 100).toFixed(0)}% scaling to fit content within slide`);
    }

    // Create slide
    const targetSlide = pres.addSlide();

    // Add background
    if (hasGradient && backgroundBase64) {
      addImageBackground(targetSlide, backgroundBase64);
    } else {
      await addBackground(slideData, targetSlide);
    }

    // Add all elements (text, shapes, lists, lines, images)
    addElements(slideData, targetSlide, pres);

    console.log(`[html2pptx-flex] Created slide with ${slideData.elements.length} native elements`);

    return { 
      slide: targetSlide, 
      screenshotBase64,
      elementCount: slideData.elements.length,
      placeholders: slideData.placeholders,
      errors: slideData.errors
    };

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[html2pptx-flex] Failed to cleanup temp dir:', e.message);
    }
  }
}

module.exports = { html2pptxFlexible };
