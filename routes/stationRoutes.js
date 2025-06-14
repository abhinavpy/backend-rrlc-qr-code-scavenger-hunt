const express = require('express');
const {
  createStation,
  getStations,
  getStation,
  updateStation,
  deleteStation,         // Add deleteStation to imports
  getStationQRCode       // Change generateQRCode to getStationQRCode
} = require('../controllers/stationController');

// --- ADD THIS CONSOLE LOG FOR DEBUGGING ---
console.log('--- stationRoutes.js ---');
console.log('Imported createStation:', typeof createStation);
console.log('Imported getStations:', typeof getStations);
console.log('Imported getStation:', typeof getStation);
console.log('Imported updateStation:', typeof updateStation);
console.log('Imported deleteStation:', typeof deleteStation);
console.log('Imported getStationQRCode:', typeof getStationQRCode);
console.log('-------------------------');
// --- END DEBUGGING LOG ---

const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Protect all routes (or apply selectively as needed)
router.use(protect);

router.route('/')
  .get(getStations) // Assuming getStations might not need admin authorization, or add authorize('admin') if it does
  .post(authorize('admin'), createStation);

// Route for QR code generation - ensure 'admin' can access this
// Using :stationId to match controller, and 'qrcode' to match controller's comment, adjust if frontend calls /qr
router.get('/:stationId/qrcode', authorize('admin'), getStationQRCode); 

router.route('/:id')
  .get(getStation) // Assuming getStation might not need admin authorization
  .put(authorize('admin'), updateStation)
  .delete(authorize('admin'), deleteStation); // Add the delete route

module.exports = router;