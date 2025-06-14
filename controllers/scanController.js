const Scan = require('../models/Scan');
const Station = require('../models/Station');
const Class = require('../models/Class');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     Scan:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "60c72b2f9b1d8c001c8e4d8e"
 *         classId:
 *           type: string
 *           description: ID of the class that scanned
 *           example: "60c72b2f9b1d8c001c8e4d8c"
 *         stationId:
 *           type: string
 *           description: ID of the station scanned
 *           example: "60c72b2f9b1d8c001c8e4d8d"
 *         scannedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the scan
 *         deviceInfo:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               example: "mobile"
 *             browser:
 *               type: string
 *               example: "Chrome"
 *             ip:
 *               type: string
 *               example: "192.168.1.1"
 *     ScanInput:
 *       type: object
 *       required:
 *         - classId
 *         - stationQRCode
 *       properties:
 *         classId:
 *           type: string
 *           description: ID of the class performing the scan.
 *           example: "60c72b2f9b1d8c001c8e4d8c"
 *         stationQRCode:
 *           type: string
 *           description: The unique QR code identifier of the station scanned.
 *           example: "a1b2c3d4e5f6a7b8"
 *         deviceInfo:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               example: "mobile"
 *             browser:
 *               type: string
 *               example: "Chrome"
 */

/**
 * @swagger
 * tags:
 *   name: Scans
 *   description: QR Code Scan Management
 */

/**
 * @swagger
 * /scans:
 *   post:
 *     summary: Record a new QR code scan
 *     tags: [Scans]
 *     description: Records a scan event for a class at a specific station. Ensures a class can only scan a station once.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScanInput'
 *     responses:
 *       201:
 *         description: Scan recorded successfully. Returns the station details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Scan recorded successfully!"
 *                 stationData:
 *                   $ref: '#/components/schemas/Station'
 *       400:
 *         description: Invalid input, class or station not found, or station already scanned by this class.
 *       401:
 *         description: Not authorized.
 *     security:
 *       - bearerAuth: []
 */
exports.recordScan = asyncHandler(async (req, res, next) => {
  const { classId, stationQRCode, deviceInfo } = req.body;

  console.log('Received scan request:', { classId, stationQRCode });

  if (!classId || !stationQRCode) {
    logger.warn('Record scan: Missing classId or stationQRCode.');
    return next(new ErrorResponse('Please provide classId and stationQRCode', 400));
  }

  // Find station by ID (stationQRCode should be the station ID)
  const station = await Station.findById(stationQRCode);
  if (!station) {
    logger.warn(`Record scan: Station with ID ${stationQRCode} not found.`);
    return next(new ErrorResponse(`Station with ID ${stationQRCode} not found`, 404));
  }
  if (!station.isActive) {
    logger.warn(`Record scan: Station ${station.name} (ID: ${stationQRCode}) is not active.`);
    return next(new ErrorResponse(`Station ${station.name} is not active`, 400));
  }

  const classObj = await Class.findById(classId);
  if (!classObj) {
    logger.warn(`Record scan: Class with ID ${classId} not found.`);
    return next(new ErrorResponse(`Class with ID ${classId} not found`, 404));
  }
  if (!classObj.isActive) {
    logger.warn(`Record scan: Class ${classObj.name} (ID: ${classId}) is not active.`);
    return next(new ErrorResponse(`Class ${classObj.name} is not active`, 400));
  }

  // Check for existing scan using the correct field names
  const existingScan = await Scan.findOne({ classId: classId, stationId: station._id });
  if (existingScan) {
    logger.info(`Station ${station.name} (ID: ${station._id}) already scanned by class ${classObj.name}. Attempting to update lastScanAt.`);
    const oldLastScanAt = classObj.lastScanAt ? new Date(classObj.lastScanAt).getTime() : null;
    classObj.lastScanAt = new Date();

    if (!oldLastScanAt || oldLastScanAt !== classObj.lastScanAt.getTime()) {
        try {
            await classObj.save();
            logger.info(`Class ${classObj.name} (ID: ${classId}) lastScanAt updated to ${classObj.lastScanAt}.`);
        } catch (saveError) {
            logger.error(`Error updating lastScanAt for existing scan, class ${classObj.name} (ID: ${classId}): ${saveError.message}`, saveError);
        }
    } else {
        logger.info(`Class ${classObj.name} (ID: ${classId}) lastScanAt already current.`);
    }

    return res.status(200).json({
      success: true,
      message: `Station "${station.name}" has already been scanned by class ${classObj.name}.`,
      stationData: {
        _id: station._id,
        name: station.name,
        educationalInfo: station.educationalInfo,
        imageUrl: station.imageUrl,
        funFacts: station.funFacts,
        safetyTips: station.safetyTips,
        learningObjectives: station.learningObjectives,
        activityType: station.activityType,
        ageGroup: station.ageGroup,
        difficulty: station.difficulty,
        estimatedTime: station.estimatedTime,
        maxParticipants: station.maxParticipants
      },
      existing: true,
    });
  }

  // Record the new scan with correct field names
  await Scan.create({
    classId: classId,        // ✅ Fixed: use classId instead of class
    stationId: station._id,  // ✅ Fixed: use stationId instead of station
    deviceInfo: {
      type: deviceInfo?.type,
      browser: deviceInfo?.browser,
      ip: req.ip,
    },
  });
  logger.info(`New scan recorded for class ${classObj.name} (ID: ${classId}) at station ${station.name} (ID: ${station._id}).`);

  // --- Update Class document ---
  let wasClassModified = false;

  // Add station to stationsScanned if not already present
  const stationIdStr = station._id.toString();
  if (!classObj.stationsScanned.map(id => id.toString()).includes(stationIdStr)) {
    classObj.stationsScanned.push(station._id);
    logger.info(`Station ${station.name} (ID: ${station._id}) added to stationsScanned for class ${classObj.name}. New count: ${classObj.stationsScanned.length}`);
    wasClassModified = true;
  }

  // Update lastScanAt timestamp
  classObj.lastScanAt = new Date();
  wasClassModified = true;

  // Check for hunt completion if not already completed
  if (!classObj.isCompleted) {
    const totalActiveStations = await Station.countDocuments({ isActive: true });
    logger.info(`Class ${classObj.name} (ID: ${classId}): Checking hunt completion. Scanned unique: ${classObj.stationsScanned.length}, Total Active: ${totalActiveStations}`);

    if (classObj.stationsScanned.length >= totalActiveStations && totalActiveStations > 0) {
      classObj.isCompleted = true;
      classObj.completedAt = new Date();
      logger.info(`Hunt COMPLETED for class ${classObj.name} (ID: ${classId}) at ${classObj.completedAt}.`);
      wasClassModified = true;
    } else if (totalActiveStations === 0 && classObj.stationsScanned.length === 0) {
      classObj.isCompleted = true;
      classObj.completedAt = new Date();
      logger.info(`Hunt marked completed for class ${classObj.name} (ID: ${classId}) as there are no active stations.`);
      wasClassModified = true;
    }
  }

  if (wasClassModified) {
    logger.info(`Class ${classObj.name} (ID: ${classId}) is being saved. isCompleted: ${classObj.isCompleted}, stationsScanned count: ${classObj.stationsScanned.length}, lastScanAt: ${classObj.lastScanAt}`);
    try {
      const updatedClass = await classObj.save();
      logger.info(`Class ${classObj.name} (ID: ${classId}) successfully saved. DB state - isCompleted: ${updatedClass.isCompleted}, stationsScanned count: ${updatedClass.stationsScanned.length}, lastScanAt: ${updatedClass.lastScanAt}`);
    } catch (saveError) {
      logger.error(`CRITICAL: Error saving class object for classId ${classId} after scan processing: ${saveError.message}`, saveError);
    }
  } else {
    logger.info(`Class ${classObj.name} (ID: ${classId}) had no modifications needing save.`);
  }

  res.status(201).json({
    success: true,
    message: `Scan recorded successfully for station: ${station.name}!`,
    stationData: {
      _id: station._id,
      name: station.name,
      educationalInfo: station.educationalInfo,
      imageUrl: station.imageUrl,
      funFacts: station.funFacts,
      safetyTips: station.safetyTips,
      learningObjectives: station.learningObjectives,
      activityType: station.activityType,
      ageGroup: station.ageGroup,
      difficulty: station.difficulty,
      estimatedTime: station.estimatedTime,
      maxParticipants: station.maxParticipants
    },
    existing: false,
  });
});

/**
 * @swagger
 * /scans/class/{classId}:
 *   get:
 *     summary: Get all scans for a specific class
 *     tags: [Scans]
 *     description: Retrieves a list of all stations scanned by a particular class.
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the class
 *     responses:
 *       200:
 *         description: A list of scans for the class.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Scan'
 *       401:
 *         description: Not authorized.
 *       404:
 *         description: Class not found.
 *     security:
 *       - bearerAuth: []
 */
exports.getScansByClass = asyncHandler(async (req, res, next) => {
  const { classId } = req.params;

  const classObj = await Class.findById(classId).populate('stationsScanned', 'name');
  if (!classObj) {
    return next(new ErrorResponse(`Class not found with id of ${classId}`, 404));
  }

  if (req.user.role !== 'admin' && (!classObj.teacher || !classObj.teacher._id || classObj.teacher._id.toString() !== req.user.id)) {
    return next(new ErrorResponse(`User not authorized to view scans for this class`, 403));
  }

  // Use correct field names for querying
  const scans = await Scan.find({ classId: classId }).populate('stationId', 'name educationalInfo isActive');

  res.status(200).json({
    success: true,
    classData: {
        _id: classObj._id,
        name: classObj.name,
        isCompleted: classObj.isCompleted,
        stationsScanned: classObj.stationsScanned,
        lastScanAt: classObj.lastScanAt,
        completedAt: classObj.completedAt
    },
    scans: {
        count: scans.length,
        data: scans,
    }
  });
});

/**
 * @swagger
 * /scans/station/{stationId}:
 *   get:
 *     summary: Get all scans for a specific station
 *     tags: [Scans]
 *     description: Retrieves a list of all classes that have scanned a particular station (Admin only).
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the station
 *     responses:
 *       200:
 *         description: A list of scans for the station.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Scan'
 *       401:
 *         description: Not authorized.
 *       403:
 *         description: Forbidden (user is not an admin).
 *       404:
 *         description: Station not found.
 *     security:
 *       - bearerAuth: []
 */
exports.getScansByStation = asyncHandler(async (req, res, next) => {
  const { stationId } = req.params;

  const station = await Station.findById(stationId);
  if (!station) {
    return next(new ErrorResponse(`Station not found with id of ${stationId}`, 404));
  }

  // Use correct field names for querying
  const scans = await Scan.find({ stationId: stationId }).populate({
    path: 'classId',
    select: 'name school teacher isActive isCompleted lastScanAt stationsScanned completedAt',
    populate: {
      path: 'teacher._id',
      select: 'name email',
      model: 'User'
    },
  });

  res.status(200).json({
    success: true,
    count: scans.length,
    data: scans,
  });
});