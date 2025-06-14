const express = require('express');
const {
  getAnalyticsOverview,
  getStationHeatmap,
  getTimePatterns,
  getEngagementMetrics,
  getHistoricalData
} = require('../controllers/analyticsController');

const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

router.get('/overview', getAnalyticsOverview);
router.get('/station-heatmap', getStationHeatmap);
router.get('/time-patterns', getTimePatterns);
router.get('/engagement', getEngagementMetrics);
router.get('/historical', getHistoricalData);

module.exports = router;