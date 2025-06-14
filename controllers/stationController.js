const Station = require('../models/Station');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// @desc    Create a new station
// @route   POST /api/stations
// @access  Private (Admin only)
exports.createStation = asyncHandler(async (req, res, next) => {
  const station = await Station.create(req.body);

  res.status(201).json({
    success: true,
    data: station
  });
});

// @desc    Get all stations
// @route   GET /api/stations
// @access  Private
exports.getStations = asyncHandler(async (req, res, next) => {
  const stations = await Station.find();

  res.status(200).json({
    success: true,
    count: stations.length,
    data: stations
  });
});

// @desc    Get a single station
// @route   GET /api/stations/:id
// @access  Private
exports.getStation = asyncHandler(async (req, res, next) => {
  const station = await Station.findById(req.params.id);

  if (!station) {
    return next(new ErrorResponse(`Station not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: station
  });
});

// @desc    Update a station
// @route   PUT /api/stations/:id
// @access  Private (Admin only)
exports.updateStation = asyncHandler(async (req, res, next) => {
  let station = await Station.findById(req.params.id);

  if (!station) {
    return next(new ErrorResponse(`Station not found with id of ${req.params.id}`, 404));
  }

  // Don't allow changing the QR code
  if (req.body.qrCode) {
    delete req.body.qrCode;
  }

  station = await Station.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: station
  });
});

// @desc    Delete a station
// @route   DELETE /api/stations/:id
// @access  Private (Admin only)
exports.deleteStation = asyncHandler(async (req, res, next) => {
  const station = await Station.findById(req.params.id);

  if (!station) {
    return next(new ErrorResponse(`Station not found with id of ${req.params.id}`, 404));
  }

  await station.deleteOne(); // or station.remove() for older mongoose versions

  res.status(200).json({
    success: true,
    data: {} // Or a message like { message: 'Station deleted successfully' }
  });
});


// @desc    Get QR code for a station
// @route   GET /api/stations/:stationId/qrcode
// @access  Private/Admin (assuming admin generates these)
exports.getStationQRCode = asyncHandler(async (req, res, next) => {
    const { stationId } = req.params;

    const station = await Station.findById(stationId);

    if (!station) {
        return next(new ErrorResponse(`Station not found with id of ${stationId}`, 404));
    }

    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; 
    const scanUrl = `${frontendBaseUrl}/scan-station/${stationId}`; 

    try {
        const qrCodeDataURL = await QRCode.toDataURL(scanUrl, {
            errorCorrectionLevel: 'H', 
            type: 'image/png',
            margin: 2,
            color: {
                dark:"#000000",
                light:"#FFFFFF" 
            }
        });
        
        logger.info(`Generated QR code for station ${stationId} pointing to ${scanUrl}`);
        res.status(200).json({
            success: true,
            data: {
                qrCodeDataURL: qrCodeDataURL,
                scanUrl: scanUrl 
            }
        });
    } catch (err) {
        logger.error(`Error generating QR code for station ${stationId}: ${err.message}`);
        return next(new ErrorResponse('Failed to generate QR code', 500));
    }
});

module.exports = {
  createStation: exports.createStation,
  getStations: exports.getStations,
  getStation: exports.getStation,
  updateStation: exports.updateStation,
  deleteStation: exports.deleteStation, // Now this should be defined
  getStationQRCode: exports.getStationQRCode
};