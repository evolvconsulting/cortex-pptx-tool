/**
 * Routes - Define all API endpoints
 */

const express = require('express');
const { getHealth, convertSlides } = require('../controllers');

const router = express.Router();

// Health check
router.get('/health', getHealth);

// Convert HTML slides to PPTX
router.post('/convert', convertSlides);

module.exports = router;
