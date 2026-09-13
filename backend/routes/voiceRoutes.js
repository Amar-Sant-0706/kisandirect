const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

// Voice briefing & query endpoints
router.get('/briefing', voiceController.getVoiceBriefing);
router.post('/query', voiceController.handleVoiceQuery);

module.exports = router;
