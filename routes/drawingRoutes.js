const express = require('express');
const {
  createDrawing,
  getDrawings,
  getDrawing,
  runDrawing,
  getEligibleClassesForDrawing // Import the new function
} = require('../controllers/drawingController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All drawing routes are admin only
router.use(protect);
router.use(authorize('admin'));

// --- Specific string routes first ---
router.get('/eligible-classes', getEligibleClassesForDrawing); // Add the new route HERE

// --- General routes for managing drawing "events" or configurations ---
router.route('/')
  .post(createDrawing)
  .get(getDrawings);

// --- Parameterized routes for specific drawing "events" or configurations ---
router.route('/:id')
  .get(getDrawing);

// Route to run a *specific, pre-existing* drawing event/configuration by its ID
router.post('/:id/run', runDrawing);

module.exports = router;