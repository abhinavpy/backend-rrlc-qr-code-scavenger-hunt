const Drawing = require('../models/Drawing');
const Class = require('../models/Class');
const Station = require('../models/Station');
const Scan = require('../models/Scan');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');
// const { sendEmail } = require('../services/emailService'); // We'll create this later

/**
 * @swagger
 * components:
 *   schemas:
 *     Drawing:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Spring Education Day Raffle"
 *         date:
 *           type: string
 *           format: date-time
 *         eligibleClasses:
 *           type: array
 *           items:
 *             type: string # Class IDs
 *         winners:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               class:
 *                 type: string # Class ID
 *               prize:
 *                 type: string
 *                 example: "Grand Prize Pizza Party"
 *               notified:
 *                 type: boolean
 *                 default: false
 *         weightingFactors:
 *           type: object
 *           properties:
 *             completionTime:
 *               type: number
 *               default: 1
 *               description: "Multiplier for faster completion (e.g., 1.5 for 50% more chance)"
 *             stationsFound:
 *               type: number
 *               default: 1
 *               description: "Multiplier per station found (e.g., 0.1 for 10% more chance per station)"
 *         status:
 *           type: string
 *           enum: [pending, completed]
 *           default: "pending"
 *         createdBy:
 *           type: string # User ID of admin
 *     DrawingInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: "Annual Scavenger Hunt Draw"
 *         date:
 *           type: string
 *           format: date-time
 *           description: "Date of the drawing, defaults to now if not provided"
 *         weightingFactors:
 *           type: object
 *           properties:
 *             completionTime:
 *               type: number
 *               example: 1.2
 *             stationsFound:
 *               type: number
 *               example: 0.05
 *     RunDrawingInput:
 *       type: object
 *       required:
 *         - numberOfWinners
 *       properties:
 *         numberOfWinners:
 *           type: integer
 *           example: 3
 *           description: "How many winning classes to select"
 *         prizeDescription:
 *           type: string
 *           example: "Ice Cream Social"
 *           description: "Description of the prize for these winners"
 */

/**
 * @swagger
 * tags:
 *   name: Drawings
 *   description: Raffle Drawing Management (Admin Only)
 */

/**
 * @swagger
 * /drawings:
 *   post:
 *     summary: Create a new drawing configuration
 *     tags: [Drawings]
 *     description: Admin creates a new drawing event.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DrawingInput'
 *     responses:
 *       201:
 *         description: Drawing configuration created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drawing'
 *       400:
 *         description: Invalid input.
 *     security:
 *       - bearerAuth: []
 */
exports.createDrawing = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;
  const drawing = await Drawing.create(req.body);
  res.status(201).json({ success: true, data: drawing });
});

/**
 * @swagger
 * /drawings:
 *   get:
 *     summary: Get all drawing configurations
 *     tags: [Drawings]
 *     description: Admin retrieves a list of all drawing events.
 *     responses:
 *       200:
 *         description: A list of drawings.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Drawing'
 *     security:
 *       - bearerAuth: []
 */
exports.getDrawings = asyncHandler(async (req, res, next) => {
  const drawings = await Drawing.find().populate('createdBy', 'name email').populate('winners.class', 'name school teacher.name');
  res.status(200).json({ success: true, count: drawings.length, data: drawings });
});

/**
 * @swagger
 * /drawings/{id}:
 *   get:
 *     summary: Get a single drawing configuration by ID
 *     tags: [Drawings]
 *     description: Admin retrieves details of a specific drawing event.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Drawing details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drawing'
 *       404:
 *         description: Drawing not found.
 *     security:
 *       - bearerAuth: []
 */
exports.getDrawing = asyncHandler(async (req, res, next) => {
  const drawing = await Drawing.findById(req.params.id).populate('createdBy', 'name email').populate('winners.class', 'name school teacher.name');
  if (!drawing) {
    return next(new ErrorResponse(`Drawing not found with id of ${req.params.id}`, 404));
  }
  res.status(200).json({ success: true, data: drawing });
});

/**
 * @swagger
 * /drawings/{id}/run:
 *   post:
 *     summary: Run the prize drawing
 *     tags: [Drawings]
 *     description: Admin executes the drawing to select winners based on eligibility and weighting.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the drawing configuration to run.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RunDrawingInput'
 *     responses:
 *       200:
 *         description: Drawing completed and winners selected.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Drawing' # Returns the updated drawing with winners
 *       400:
 *         description: Invalid input or no eligible classes.
 *       404:
 *         description: Drawing configuration not found.
 *       409:
 *         description: Drawing has already been completed.
 *     security:
 *       - bearerAuth: []
 */
exports.runDrawing = asyncHandler(async (req, res, next) => {
  const { numberOfWinners, prizeDescription } = req.body;
  if (!numberOfWinners || numberOfWinners <= 0) {
      return next(new ErrorResponse('Please provide a valid number of winners.', 400));
  }

  const drawing = await Drawing.findById(req.params.id);
  if (!drawing) {
    return next(new ErrorResponse(`Drawing not found with id of ${req.params.id}`, 404));
  }
  if (drawing.status === 'completed') {
    return next(new ErrorResponse('This drawing has already been completed.', 409));
  }

  const allStations = await Station.find({ isActive: true });
  const totalPossibleStations = allStations.length;

  if (totalPossibleStations === 0) {
      return next(new ErrorResponse('No active stations found. Cannot determine eligibility.', 400));
  }

  // Find all active classes
  const activeClasses = await Class.find({ isActive: true }).populate('teacher', 'email name');

  let eligibleEntries = [];

  for (const classObj of activeClasses) {
    const scans = await Scan.find({ class: classObj._id });
    const uniqueStationsScanned = new Set(scans.map(s => s.station.toString()));
    const stationsFoundCount = uniqueStationsScanned.size;

    // P0: Only classes that found ALL stations are eligible
    if (stationsFoundCount < totalPossibleStations) {
        continue; // Skip this class if they haven't found all stations
    }
    drawing.eligibleClasses.push(classObj._id); // Add to eligible list in drawing doc

    let weight = 1; // Base weight

    // Weighting for stationsFound (P1) - more stations = higher weight
    // This factor is applied even if they found all, could be a fixed bonus for completion
    weight += stationsFoundCount * (drawing.weightingFactors?.stationsFound || 0);

    // Weighting for completionTime (P1) - faster = higher weight
    if (stationsFoundCount === totalPossibleStations && scans.length > 0) {
        const sortedScans = [...scans].sort((a, b) => a.scannedAt - b.scannedAt);
        const startTime = sortedScans[0].scannedAt.getTime();
        
        const lastScanByStation = {};
        sortedScans.forEach(scan => {
            lastScanByStation[scan.station.toString()] = scan.scannedAt;
        });
        const endTime = Math.max(...Object.values(lastScanByStation).map(date => date.getTime()));
        
        const completionTimeMinutes = (endTime - startTime) / (1000 * 60);

        // Example: Inverse weighting for time - shorter time is better.
        // Max possible time could be hunt duration, min could be 1 minute.
        // This needs a more refined formula based on expected hunt duration.
        // For now, a simpler approach: if completionTime factor is > 0, apply it.
        // A smaller completionTimeMinutes should result in a higher weight.
        // Let's assume a baseline average time, e.g., 60 minutes.
        // If they are faster, weight increases. If slower, it decreases.
        // This is a placeholder for a more robust time weighting.
        if (completionTimeMinutes > 0 && drawing.weightingFactors?.completionTime) {
            // Example: if factor is 0.1, for every minute faster than 60, add 0.1 to weight
            // weight += (60 - completionTimeMinutes) * drawing.weightingFactors.completionTime;
            // For simplicity now, let's just say faster completion gives a fixed bonus if factor exists
             weight += drawing.weightingFactors.completionTime; // Add fixed bonus if factor > 0
        }
    }
    
    // Ensure weight is at least 1
    weight = Math.max(1, Math.round(weight)); 

    for (let i = 0; i < weight; i++) {
      eligibleEntries.push({ classId: classObj._id, className: classObj.name, teacherEmail: classObj.teacher.email, teacherName: classObj.teacher.name });
    }
  }

  if (eligibleEntries.length === 0) {
    return next(new ErrorResponse('No classes are eligible for the drawing based on current criteria.', 400));
  }

  // Shuffle and pick winners
  const winners = [];
  const pickedClassIds = new Set();

  // Shuffle the entries array
  for (let i = eligibleEntries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligibleEntries[i], eligibleEntries[j]] = [eligibleEntries[j], eligibleEntries[i]];
  }
  
  for (const entry of eligibleEntries) {
    if (winners.length < numberOfWinners && !pickedClassIds.has(entry.classId)) {
      winners.push({
        class: entry.classId,
        prize: prizeDescription || "Scavenger Hunt Prize",
        notified: false // Will be set to true after email notification
      });
      pickedClassIds.add(entry.classId);
    }
    if (winners.length >= numberOfWinners) break;
  }

  drawing.winners = winners;
  drawing.status = 'completed';
  await drawing.save();

  // TODO P0: Email notification to winning teachers
  // for (const winner of winners) {
  //   const classInfo = activeClasses.find(c => c._id.toString() === winner.class.toString());
  //   if (classInfo && classInfo.teacher && classInfo.teacher.email) {
  //     try {
  //       await sendEmail({
  //         to: classInfo.teacher.email,
  //         subject: `Congratulations! Your class ${classInfo.name} won the ${drawing.name}!`,
  //         text: `Dear ${classInfo.teacher.name},\n\nCongratulations! Your class, ${classInfo.name}, has won the ${drawing.name} for the prize: ${winner.prize}.\n\nMore details to follow.\n\nBest regards,\nRRLC Team`
  //       });
  //       const winnerInDb = drawing.winners.find(w => w.class.toString() === winner.class.toString());
  //       if(winnerInDb) winnerInDb.notified = true;
  //     } catch (emailError) {
  //       console.error(`Failed to send email to ${classInfo.teacher.email}:`, emailError);
  //       // Log this error, but don't stop the process
  //     }
  //   }
  // }
  // await drawing.save(); // Save again if notified status changed

  res.status(200).json({ success: true, data: drawing });
});

/**
 * @swagger
 * /drawings/eligible-classes:
 *   get:
 *     summary: Get all classes eligible for a drawing
 *     tags: [Drawings]
 *     description: Admin retrieves a list of classes that have completed the scavenger hunt (scanned all active stations).
 *     responses:
 *       200:
 *         description: A list of eligible classes.
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
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       school:
 *                         type: string
 *                       grade:
 *                         type: string
 *                       teacher:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       studentCount:
 *                         type: integer
 *                       stationsFound:
 *                         type: integer
 *                       totalStations:
 *                         type: integer
 *                       isEligible:
 *                         type: boolean
 *       400:
 *         description: Error determining eligibility (e.g., no active stations).
 *     security:
 *       - bearerAuth: []
 */
exports.getEligibleClassesForDrawing = asyncHandler(async (req, res, next) => {
    const activeStations = await Station.find({ isActive: true });
    const totalPossibleStations = activeStations.length;

    if (totalPossibleStations === 0) {
        return next(new ErrorResponse('No active stations found. Cannot determine eligibility for drawing.', 400));
    }

    const allClasses = await Class.find({ isActive: true })
        .populate('teacher', 'name email'); // Populate relevant teacher details

    const eligibleClassesOutput = [];

    for (const classObj of allClasses) {
        const classScans = await Scan.find({ class: classObj._id });
        const uniqueStationsScannedForClass = new Set(classScans.map(scan => scan.station.toString()));
        const stationsFoundCount = uniqueStationsScannedForClass.size;

        if (stationsFoundCount >= totalPossibleStations) { // Class is eligible
            eligibleClassesOutput.push({
                _id: classObj._id,
                name: classObj.name,
                school: classObj.school,
                grade: classObj.grade,
                teacher: classObj.teacher ? { name: classObj.teacher.name, email: classObj.teacher.email } : null,
                studentCount: classObj.studentCount,
                stationsFound: stationsFoundCount,
                totalStations: totalPossibleStations,
                isEligible: true
            });
        }
    }

    res.status(200).json({
        success: true,
        count: eligibleClassesOutput.length,
        data: eligibleClassesOutput
    });
});

// --- Make sure to update module.exports at the end of the file ---
// (This should be at the very end of your drawingController.js)
module.exports = {
  createDrawing: exports.createDrawing,
  getDrawings: exports.getDrawings,
  getDrawing: exports.getDrawing,
  runDrawing: exports.runDrawing,
  getEligibleClassesForDrawing: exports.getEligibleClassesForDrawing // Add the new function here
};