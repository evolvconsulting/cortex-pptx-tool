/**
 * Browser utilities for Playwright operations
 */

const { chromium } = require('playwright');
const { BROWSER_ARGS } = require('../config/constants');

/**
 * Launch browser with standard options
 */
async function launchBrowser() {
  return chromium.launch({ args: BROWSER_ARGS });
}

/**
 * Create a new page with specified viewport
 */
async function createPage(browser, width, height) {
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  return page;
}

/**
 * Navigate to file and wait for load
 */
async function navigateToFile(page, filePath, waitTime = 100) {
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(waitTime);
}

/**
 * Take a screenshot of the page
 */
async function captureScreenshot(page) {
  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  return buffer.toString('base64');
}

/**
 * Check if page has CSS gradient background
 */
async function hasGradientBackground(page) {
  return page.evaluate(() => {
    const bodyStyle = window.getComputedStyle(document.body);
    const bgImage = bodyStyle.backgroundImage;
    return bgImage && (bgImage.includes('linear-gradient') || bgImage.includes('radial-gradient'));
  });
}

module.exports = {
  launchBrowser,
  createPage,
  navigateToFile,
  captureScreenshot,
  hasGradientBackground
};
