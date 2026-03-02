/**
 * Render Service - Convert PPTX to preview images using LibreOffice
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Render PPTX to images using LibreOffice and pdftoppm
 * @param {string} base64Pptx - Base64 encoded PPTX file
 * @param {object} options - Rendering options
 * @returns {Promise<string[]>} Array of base64 encoded images
 */
async function renderToImages(base64Pptx, options = {}) {
  const { dpi = 150, format = 'jpeg' } = options;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-render-'));
  const pptxPath = path.join(tmpDir, 'presentation.pptx');
  const pdfPath = path.join(tmpDir, 'presentation.pdf');
  
  try {
    const pptxBuffer = Buffer.from(base64Pptx, 'base64');
    fs.writeFileSync(pptxPath, pptxBuffer);
    
    console.log(`[Render] Converting PPTX to PDF in ${tmpDir}`);
    
    execSync(
      `soffice --headless --convert-to pdf --outdir "${tmpDir}" "${pptxPath}"`,
      { timeout: 120000, stdio: 'pipe' }
    );
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error('LibreOffice failed to create PDF');
    }
    
    console.log(`[Render] Converting PDF to images at ${dpi} DPI`);
    
    const formatFlag = format === 'png' ? '-png' : '-jpeg';
    execSync(
      `pdftoppm ${formatFlag} -r ${dpi} "${pdfPath}" "${tmpDir}/slide"`,
      { timeout: 120000, stdio: 'pipe' }
    );
    
    const extension = format === 'png' ? '.png' : '.jpg';
    const files = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('slide-') && f.endsWith(extension))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide-(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide-(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    
    if (files.length === 0) {
      throw new Error('pdftoppm failed to create images');
    }
    
    console.log(`[Render] Generated ${files.length} slide images`);
    
    const images = [];
    for (const file of files) {
      const imgPath = path.join(tmpDir, file);
      const imgBuffer = fs.readFileSync(imgPath);
      images.push(imgBuffer.toString('base64'));
    }
    
    return images;
    
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[Render] Failed to cleanup temp dir:', e.message);
    }
  }
}

/**
 * Check if LibreOffice and pdftoppm are available
 */
function checkDependencies() {
  const result = {
    libreoffice: false,
    pdftoppm: false,
    playwright: false,
    ready: false
  };
  
  try {
    execSync('soffice --version', { stdio: 'pipe' });
    result.libreoffice = true;
  } catch (e) {
    console.warn('[Render] LibreOffice not available');
  }
  
  try {
    execSync('pdftoppm -v', { stdio: 'pipe' });
    result.pdftoppm = true;
  } catch (e) {
    console.warn('[Render] pdftoppm not available');
  }
  
  try {
    require('playwright');
    result.playwright = true;
  } catch (e) {
    console.warn('[Render] Playwright not available');
  }
  
  result.ready = result.libreoffice && result.pdftoppm;
  return result;
}

module.exports = {
  renderToImages,
  checkDependencies
};
