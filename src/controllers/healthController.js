/**
 * Health Controller - Handle health check requests
 */

const { checkDependencies } = require('../services');

const VERSION = '1.0.0';

function getHealth(req, res) {
  const deps = checkDependencies();
  res.json({ 
    status: 'healthy', 
    service: 'html2pptx-service',
    version: VERSION,
    approach: 'dom-parsing',
    rendering: deps.ready ? 'available' : 'unavailable',
    dependencies: deps
  });
}

module.exports = { getHealth, VERSION };
