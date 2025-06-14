const express = require('express');
const { 
  register, 
  login, 
  getMe, 
  logout, 
  updateProfile // Add this import
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', logout);
router.put('/profile', protect, updateProfile); // Add this route

module.exports = router;