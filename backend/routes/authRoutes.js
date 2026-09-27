const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');

router.post('/send-otp', authController.sendOtp);
router.post('/request-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', requireAuth, authController.getMe);

module.exports = router;
