/**
 * HTML Converter Service - Convert HTML slides to PPTX
 * Supports charts and tables via placeholders (matches local html2pptx skill)
 */

const pptxgenjs = require('pptxgenjs');
const { html2pptxFlexible } = require('../converters');
const { processCharts } = require('../converters/chartBuilder');
const { processTables } = require('../converters/tableBuilder');
const { getViewportDimensions } = require('../utils/dimensions');

/**
 * Convert HTML slides to PPTX using DOM parsing approach
 * @param {Array} slides - Array of slide objects with html property
 * @param {object} options - Presentation options
 * @returns {Promise<{success, output, error, execution_time}>}
 */
async function convertHtmlSlides(slides, options = {}) {
  const result = {
    success: false,
    output: null,
    error: null,
    execution_time: 0
  };

  const startTime = Date.now();

  try {
    const pres = new pptxgenjs();
    pres.layout = options.layout || 'LAYOUT_16x9';
    
    if (options.author) pres.author = options.author;
    if (options.title) pres.title = options.title;

    const { width, height } = getViewportDimensions(
      options.layout, 
      options.width, 
      options.height
    );

    const previewImages = [];

    for (let i = 0; i < slides.length; i++) {
      const slideData = slides[i];
      const htmlContent = slideData.html;

      if (!htmlContent) {
        throw new Error(`Slide ${i + 1}: Missing 'html' content`);
      }

      console.log(`[Convert] DOM parsing slide ${i + 1}/${slides.length} (native elements)`);
      
      const { slide, screenshotBase64, elementCount, placeholders } = await html2pptxFlexible(htmlContent, pres, {
        width,
        height
      });
      
      console.log(`[Convert] Slide ${i + 1}: ${elementCount || 0} native elements, ${placeholders?.length || 0} placeholders`);
      
      // Add charts to placeholders
      if (slideData.charts && placeholders && placeholders.length > 0) {
        console.log(`[Convert] Processing ${slideData.charts.length} charts for slide ${i + 1}`);
        processCharts(slide, pres, slideData.charts, placeholders);
      }
      
      // Add tables to placeholders
      if (slideData.tables && placeholders && placeholders.length > 0) {
        console.log(`[Convert] Processing ${slideData.tables.length} tables for slide ${i + 1}`);
        processTables(slide, slideData.tables, placeholders);
      }
      
      if (screenshotBase64) {
        previewImages.push(screenshotBase64);
      }
    }

    const base64 = await pres.write({ outputType: 'base64' });

    result.success = true;
    result.output = {
      base64,
      slideCount: slides.length,
      previewImages,
      approach: 'dom-parsing'
    };

  } catch (err) {
    result.error = {
      type: err.constructor.name,
      message: err.message,
      stack: err.stack
    };
  }

  result.execution_time = (Date.now() - startTime) / 1000;
  return result;
}

module.exports = { convertHtmlSlides };
