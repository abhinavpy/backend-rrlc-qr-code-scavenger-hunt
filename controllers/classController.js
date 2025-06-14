const Class = require('../models/Class');
const Scan = require('../models/Scan');
const Station = require('../models/Station');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all classes for the authenticated teacher
// @route   GET /api/classes
// @access  Private/Teacher
const getClasses = asyncHandler(async (req, res, next) => {
  const classes = await Class.find({ 'teacher._id': req.user.id }).sort({ registeredAt: -1 });

  res.status(200).json({
    success: true,
    count: classes.length,
    data: classes
  });
});

// @desc    Create a new class
// @route   POST /api/classes
// @access  Private/Teacher
const createClass = asyncHandler(async (req, res, next) => {
  const { name, grade, school, studentCount, classPicture, description } = req.body;

  // Add teacher info to the class
  const classData = {
    name,
    grade,
    school,
    studentCount,
    classPicture,
    description,
    teacher: {
      _id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  };

  const newClass = await Class.create(classData);

  res.status(201).json({
    success: true,
    data: newClass
  });
});

// @desc    Update a class
// @route   PUT /api/classes/:id
// @access  Private/Teacher (own classes only)
const updateClass = asyncHandler(async (req, res, next) => {
  const { name, grade, school, studentCount, classPicture, description } = req.body;

  let classObj = await Class.findById(req.params.id);

  if (!classObj) {
    return next(new ErrorResponse(`Class not found with id of ${req.params.id}`, 404));
  }

  // Make sure teacher owns class
  if (classObj.teacher._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to update this class`, 403));
  }

  const fieldsToUpdate = {};
  if (name) fieldsToUpdate.name = name;
  if (grade) fieldsToUpdate.grade = grade;
  if (school) fieldsToUpdate.school = school;
  if (studentCount) fieldsToUpdate.studentCount = studentCount;
  if (classPicture !== undefined) fieldsToUpdate.classPicture = classPicture;
  if (description !== undefined) fieldsToUpdate.description = description;

  classObj = await Class.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: classObj
  });
});

// @desc    Get single class details with scanned stations
// @route   GET /api/classes/:id/details
// @access  Private/Teacher (own classes only) or Admin
const getClassDetails = asyncHandler(async (req, res, next) => {
  const classObj = await Class.findById(req.params.id);

  if (!classObj) {
    return next(new ErrorResponse(`Class not found with id of ${req.params.id}`, 404));
  }

  // Make sure teacher owns class or is admin
  if (classObj.teacher._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to view this class`, 403));
  }

  let scannedStationsDetails = [];
  
  try {
    console.log(`Looking for scans for class ${req.params.id}`);
    
    // First, let's try to find scans without populate to see what fields exist
    let scans = await Scan.find({ classId: req.params.id });
    console.log('Scans found with classId:', scans.length);
    
    if (!scans || scans.length === 0) {
      // Try alternative field names
      scans = await Scan.find({ class: req.params.id });
      console.log('Scans found with class field:', scans.length);
    }
    
    if (!scans || scans.length === 0) {
      scans = await Scan.find({ 'class._id': req.params.id });
      console.log('Scans found with class._id:', scans.length);
    }

    if (scans && scans.length > 0) {
      console.log('Sample scan object:', JSON.stringify(scans[0], null, 2));
      
      // Try different populate field names based on what's in the scan
      const sampleScan = scans[0];
      let populateField = 'station'; // default
      
      if (sampleScan.stationId) {
        populateField = 'stationId';
      } else if (sampleScan.station) {
        populateField = 'station';
      } else if (sampleScan.stationCode) {
        populateField = 'stationCode';
      }
      
      console.log('Using populate field:', populateField);
      
      // Re-fetch with populate
      scans = await Scan.find({ classId: req.params.id })
        .populate(populateField, 'name description educationalInfo imageUrl funFacts safetyTips learningObjectives ageGroup difficulty estimatedTime activityType maxParticipants location')
        .sort({ createdAt: 1 });
        
      if (!scans || scans.length === 0) {
        scans = await Scan.find({ class: req.params.id })
          .populate(populateField, 'name description educationalInfo imageUrl funFacts safetyTips learningObjectives ageGroup difficulty estimatedTime activityType maxParticipants location')
          .sort({ createdAt: 1 });
      }
      
      if (!scans || scans.length === 0) {
        scans = await Scan.find({ 'class._id': req.params.id })
          .populate(populateField, 'name description educationalInfo imageUrl funFacts safetyTips learningObjectives ageGroup difficulty estimatedTime activityType maxParticipants location')
          .sort({ createdAt: 1 });
      }

      if (scans && scans.length > 0) {
        scannedStationsDetails = scans.map(scan => ({
          scanId: scan._id,
          scannedAt: scan.scannedAt || scan.createdAt,
          station: scan[populateField] || scan.station || scan.stationId
        })).filter(item => item.station); // Filter out items where station is null
      }
    }

    // Fallback: use stationsScanned array from class if no scans found
    if (scannedStationsDetails.length === 0 && classObj.stationsScanned && classObj.stationsScanned.length > 0) {
      console.log('Falling back to stationsScanned array');
      const stations = await Station.find({ 
        '_id': { $in: classObj.stationsScanned } 
      });
      
      scannedStationsDetails = stations.map((station, index) => ({
        scanId: `${classObj._id}_${station._id}`,
        scannedAt: classObj.lastScanAt || classObj.registeredAt,
        station: station
      }));
    }

    console.log(`Found ${scannedStationsDetails.length} scanned stations for class ${req.params.id}`);

  } catch (error) {
    console.error('Error fetching scans:', error);
    
    // Fallback to using stationsScanned array from class
    if (classObj.stationsScanned && classObj.stationsScanned.length > 0) {
      console.log('Using fallback: stationsScanned array from class');
      try {
        const stations = await Station.find({ 
          '_id': { $in: classObj.stationsScanned } 
        });
        
        scannedStationsDetails = stations.map((station, index) => ({
          scanId: `${classObj._id}_${station._id}`,
          scannedAt: classObj.lastScanAt || classObj.registeredAt,
          station: station
        }));
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
      }
    }
  }

  // Get total active stations for progress calculation
  const totalActiveStations = await Station.countDocuments({ isActive: true });
  const completedCount = scannedStationsDetails.length;
  const progressPercentage = totalActiveStations > 0 ? Math.round((completedCount / totalActiveStations) * 100) : 0;

  let completionTime = null;
  if (classObj.isCompleted && classObj.completedAt && classObj.registeredAt) {
    completionTime = (new Date(classObj.completedAt) - new Date(classObj.registeredAt)) / (1000 * 60); // minutes
  }

  res.status(200).json({
    success: true,
    data: {
      class: classObj,
      scannedStations: scannedStationsDetails,
      progress: {
        completedCount,
        totalStations: totalActiveStations,
        progressPercentage,
        isCompleted: classObj.isCompleted,
        completedAt: classObj.completedAt,
        lastScanAt: classObj.lastScanAt,
        completionTime
      }
    }
  });
});

// @desc    Get single class progress
// @route   GET /api/classes/:id/progress
// @access  Private/Teacher (own classes only) or Admin
const getClassProgress = asyncHandler(async (req, res, next) => {
  const classObj = await Class.findById(req.params.id);

  if (!classObj) {
    return next(new ErrorResponse(`Class not found with id of ${req.params.id}`, 404));
  }

  // Make sure teacher owns class or is admin
  if (classObj.teacher._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to view this class`, 403));
  }

  const totalActiveStations = await Station.countDocuments({ isActive: true });
  
  // Try to get actual scan count first
  let completedCount = 0;
  try {
    // Try different possible field names for class reference in scans
    let scanCount = await Scan.countDocuments({ classId: req.params.id });
    if (scanCount === 0) {
      scanCount = await Scan.countDocuments({ class: req.params.id });
    }
    if (scanCount === 0) {
      scanCount = await Scan.countDocuments({ 'class._id': req.params.id });
    }
    
    if (scanCount > 0) {
      completedCount = scanCount;
    } else {
      // Fallback to stationsScanned array
      completedCount = classObj.stationsScanned ? classObj.stationsScanned.length : 0;
    }
  } catch (error) {
    console.error('Error counting scans:', error);
    completedCount = classObj.stationsScanned ? classObj.stationsScanned.length : 0;
  }

  const progressPercentage = totalActiveStations > 0 ? Math.round((completedCount / totalActiveStations) * 100) : 0;

  let completionTime = null;
  if (classObj.isCompleted && classObj.completedAt && classObj.registeredAt) {
    completionTime = (new Date(classObj.completedAt) - new Date(classObj.registeredAt)) / (1000 * 60); // minutes
  }

  res.status(200).json({
    success: true,
    data: {
      completedCount,
      totalStations: totalActiveStations,
      progressPercentage,
      isCompleted: classObj.isCompleted,
      completedAt: classObj.completedAt,
      lastScanAt: classObj.lastScanAt,
      completionTime
    }
  });
});

// @desc    Get single class details
// @route   GET /api/classes/:id
// @access  Private/Teacher (own classes only) or Admin
const getClass = asyncHandler(async (req, res, next) => {
  const classObj = await Class.findById(req.params.id).populate('stationsScanned', 'name');

  if (!classObj) {
    return next(new ErrorResponse(`Class not found with id of ${req.params.id}`, 404));
  }

  // Make sure teacher owns class or is admin
  if (classObj.teacher._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`User not authorized to view this class`, 403));
  }

  res.status(200).json({
    success: true,
    data: classObj
  });
});

module.exports = {
  getClasses,
  createClass,
  updateClass,
  getClassDetails,
  getClassProgress,
  getClass
};