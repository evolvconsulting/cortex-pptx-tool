/**
 * Convert Controller - Handle HTML to PPTX conversion requests
 */

const { convertHtmlSlides } = require('../services');

/**
 * Convert HTML slides to PPTX endpoint
 */
async function convertSlides(req, res) {
  try {
    const data = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'Missing request body' });
    }

    // Snowflake format
    if (data.data && Array.isArray(data.data)) {
      const results = await handleSnowflakeFormat(data.data);
      return res.json({ data: results });
    }

    // Direct format
    if (data.slides) {
      const result = await handleDirectFormat(data.slides, data.options);
      return res.json(result);
    }

    return res.status(400).json({ success: false, error: "Expected 'slides' array or Snowflake format" });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ success: false, error: `Internal server error: ${err.message}` });
  }
}

/**
 * Handle Snowflake row format
 */
async function handleSnowflakeFormat(rows) {
  const results = [];

  for (const row of rows) {
    const rowIndex = row[0];
    const config = row[1];

    if (!config || typeof config !== 'object') {
      results.push([rowIndex, { success: false, error: 'Config must be an object', execution_time: 0 }]);
      continue;
    }

    if (!config.slides || !Array.isArray(config.slides)) {
      results.push([rowIndex, { success: false, error: 'Config must have slides array', execution_time: 0 }]);
      continue;
    }

    console.log(`[${new Date().toISOString()}] Converting ${config.slides.length} HTML slides (dom-parsing - native elements)`);
    const convertResult = await convertHtmlSlides(config.slides, config.options || {});

    results.push([rowIndex, convertResult]);
  }

  return results;
}

/**
 * Handle direct format (slides array)
 */
async function handleDirectFormat(slides, options) {
  console.log(`[${new Date().toISOString()}] Converting ${slides.length} HTML slides (dom-parsing - native elements)`);
  return convertHtmlSlides(slides, options || {});
}

module.exports = { convertSlides };
