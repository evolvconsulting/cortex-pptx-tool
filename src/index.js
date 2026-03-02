#!/usr/bin/env node
/**
 * HTML2PPTX Service for Snowpark Container Services
 * v1.0.0 - DOM parsing approach for /convert endpoint (native editable PowerPoint elements)
 * 
 * Endpoints:
 * - GET  /health   - Health check with dependency status
 * - POST /convert  - Convert HTML slides to PPTX (DOM parsing: creates native editable elements)
 */

const express = require('express');
const routes = require('./routes');
const { checkDependencies } = require('./services');
const { VERSION } = require('./controllers');

const app = express();
app.use(express.json({ limit: '50mb' }));

// Mount routes
app.use('/', routes);

// Start server
const PORT = process.argv[2] || process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTML2PPTX Service v${VERSION} (dom-parsing - native elements) listening on port ${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /health   - Health check');
  console.log('  POST /convert  - Convert HTML slides to PPTX (native editable elements)');
  
  const deps = checkDependencies();
  console.log('Dependencies:', deps);
});

module.exports = app;
