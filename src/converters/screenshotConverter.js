/**
 * Screenshot Converter - Render HTML to PNG and insert as slide image
 * Fast approach but not editable
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { launchBrowser, navigateToFile, captureScreenshot } = require('../utils/browser');
const { DEFAULT_WIDTH, DEFAULT_HEIGHT } = require('../config/constants');

/**
 * Screenshot-first approach: Render HTML to PNG, insert as slide image
 * 
 * @param {string} htmlContent - HTML content as string
 * @param {object} pres - PptxGenJS presentation instance
 * @param {object} options - Options (width, height in pixels)
 * @returns {Promise<{slide, screenshotBase64}>}
 */
async function html2pptxScreenshot(htmlContent, pres, options = {}) {
  const width = options.width || DEFAULT_WIDTH;
  const height = options.height || DEFAULT_HEIGHT;
  
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html2pptx-screenshot-'));
  const htmlPath = path.join(tmpDir, 'slide.html');

  try {
    fs.writeFileSync(htmlPath, htmlContent);

    const browser = await launchBrowser();
    let screenshotBase64;

    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width, height });
      await navigateToFile(page, htmlPath);
      
      screenshotBase64 = await captureScreenshot(page);
      
    } finally {
      await browser.close();
    }

    // Create slide with screenshot as full-slide image
    const targetSlide = pres.addSlide();
    
    targetSlide.addImage({
      data: `image/png;base64,${screenshotBase64}`,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%'
    });

    return { 
      slide: targetSlide, 
      screenshotBase64 
    };

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[html2pptx-screenshot] Failed to cleanup temp dir:', e.message);
    }
  }
}

module.exports = { html2pptxScreenshot };
