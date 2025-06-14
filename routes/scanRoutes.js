const express = require('express');
const {
  recordScan,
  getScansByClass,
  getScansByStation
} = require('../controllers/scanController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All scan routes should be protected
router.use(protect);

router.post('/', recordScan); // Anyone authenticated can record a scan (e.g., a class device)
router.get('/class/:classId', getScansByClass); // Teacher for their class, or Admin
router.get('/station/:stationId', authorize('admin'), getScansByStation); // Admin only

module.exports = router;