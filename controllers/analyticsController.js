const Class = require('../models/Class');
const Scan = require('../models/Scan');
const Station = require('../models/Station');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get comprehensive analytics data
// @route   GET /api/analytics/overview
// @access  Private/Admin
const getAnalyticsOverview = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  // Build date filter
  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter.registeredAt = {};
    if (startDate) dateFilter.registeredAt.$gte = new Date(startDate);
    if (endDate) dateFilter.registeredAt.$lte = new Date(endDate);
  }

  // Get basic metrics
  const totalClasses = await Class.countDocuments(dateFilter);
  const completedClasses = await Class.countDocuments({ ...dateFilter, isCompleted: true });
  const totalStations = await Station.countDocuments({ isActive: true });
  const totalScans = await Scan.countDocuments();
  
  // Get completion rate
  const completionRate = totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0;

  // Get average completion time for completed classes
  const completedClassesWithTime = await Class.find({ 
    ...dateFilter, 
    isCompleted: true, 
    completedAt: { $exists: true },
    registeredAt: { $exists: true }
  });
  
  const avgCompletionTime = completedClassesWithTime.length > 0 
    ? completedClassesWithTime.reduce((sum, cls) => {
        const timeDiff = (new Date(cls.completedAt) - new Date(cls.registeredAt)) / (1000 * 60); // minutes
        return sum + timeDiff;
      }, 0) / completedClassesWithTime.length
    : 0;

  // Get participation by grade
  const gradeDistribution = await Class.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$grade', count: { $sum: 1 }, students: { $sum: '$studentCount' } } },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalClasses,
        completedClasses,
        totalStations,
        totalScans,
        completionRate,
        avgCompletionTime: Math.round(avgCompletionTime)
      },
      gradeDistribution
    }
  });
});

// @desc    Get station popularity heatmap data
// @route   GET /api/analytics/station-heatmap
// @access  Private/Admin
const getStationHeatmap = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  // Build date filter for scans
  let scanDateFilter = {};
  if (startDate || endDate) {
    scanDateFilter.scannedAt = {};
    if (startDate) scanDateFilter.scannedAt.$gte = new Date(startDate);
    if (endDate) scanDateFilter.scannedAt.$lte = new Date(endDate);
  }

  // Get scan counts per station
  const stationScans = await Scan.aggregate([
    { $match: scanDateFilter },
    { $group: { _id: '$stationId', scanCount: { $sum: 1 } } },
    { $lookup: { 
        from: 'stations', 
        localField: '_id', 
        foreignField: '_id', 
        as: 'station' 
      }
    },
    { $unwind: '$station' },
    { $project: {
        stationId: '$_id',
        name: '$station.name',
        location: '$station.location',
        coordinates: '$station.coordinates',
        scanCount: 1,
        _id: 0
      }
    },
    { $sort: { scanCount: -1 } }
  ]);

  // Get stations with no scans
  const scannedStationIds = stationScans.map(s => s.stationId);
  const unscannedStations = await Station.find({
    _id: { $nin: scannedStationIds },
    isActive: true
  }).select('name location coordinates');

  const heatmapData = [
    ...stationScans,
    ...unscannedStations.map(station => ({
      stationId: station._id,
      name: station.name,
      location: station.location,
      coordinates: station.coordinates,
      scanCount: 0
    }))
  ];

  res.status(200).json({
    success: true,
    data: heatmapData
  });
});

// @desc    Get time-based analytics
// @route   GET /api/analytics/time-patterns
// @access  Private/Admin
const getTimePatterns = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, groupBy = 'hour' } = req.query;
  
  let dateFilter = {};
  if (startDate || endDate) {
    dateFilter.scannedAt = {};
    if (startDate) dateFilter.scannedAt.$gte = new Date(startDate);
    if (endDate) dateFilter.scannedAt.$lte = new Date(endDate);
  }

  // Group by different time periods
  let groupByStage;
  switch (groupBy) {
    case 'hour':
      groupByStage = {
        $group: {
          _id: { $hour: '$scannedAt' },
          scanCount: { $sum: 1 },
          uniqueClasses: { $addToSet: '$classId' }
        }
      };
      break;
    case 'day':
      groupByStage = {
        $group: {
          _id: { $dayOfWeek: '$scannedAt' },
          scanCount: { $sum: 1 },
          uniqueClasses: { $addToSet: '$classId' }
        }
      };
      break;
    case 'date':
      groupByStage = {
        $group: {
          _id: { 
            year: { $year: '$scannedAt' },
            month: { $month: '$scannedAt' },
            day: { $dayOfMonth: '$scannedAt' }
          },
          scanCount: { $sum: 1 },
          uniqueClasses: { $addToSet: '$classId' }
        }
      };
      break;
    default:
      groupByStage = {
        $group: {
          _id: { $hour: '$scannedAt' },
          scanCount: { $sum: 1 },
          uniqueClasses: { $addToSet: '$classId' }
        }
      };
  }

  const timePatterns = await Scan.aggregate([
    { $match: dateFilter },
    groupByStage,
    { $project: {
        period: '$_id',
        scanCount: 1,
        uniqueClassCount: { $size: '$uniqueClasses' },
        _id: 0
      }
    },
    { $sort: { period: 1 } }
  ]);

  // Get completion times distribution
  const completionTimes = await Class.aggregate([
    { 
      $match: { 
        isCompleted: true, 
        completedAt: { $exists: true },
        registeredAt: { $exists: true }
      }
    },
    { 
      $project: {
        completionTime: {
          $divide: [
            { $subtract: ['$completedAt', '$registeredAt'] },
            1000 * 60 // Convert to minutes
          ]
        }
      }
    },
    { 
      $bucket: {
        groupBy: '$completionTime',
        boundaries: [0, 30, 60, 90, 120, 180, 240, 300, 999999],
        default: 'other',
        output: { count: { $sum: 1 } }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      timePatterns,
      completionTimes
    }
  });
});

// @desc    Get engagement metrics
// @route   GET /api/analytics/engagement
// @access  Private/Admin
const getEngagementMetrics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  let classDateFilter = {};
  let scanDateFilter = {};
  
  if (startDate || endDate) {
    classDateFilter.registeredAt = {};
    scanDateFilter.scannedAt = {};
    if (startDate) {
      classDateFilter.registeredAt.$gte = new Date(startDate);
      scanDateFilter.scannedAt.$gte = new Date(startDate);
    }
    if (endDate) {
      classDateFilter.registeredAt.$lte = new Date(endDate);
      scanDateFilter.scannedAt.$lte = new Date(endDate);
    }
  }

  // Scan velocity (scans per class over time)
  const scanVelocity = await Scan.aggregate([
    { $match: scanDateFilter },
    { $group: {
        _id: '$classId',
        scanCount: { $sum: 1 },
        firstScan: { $min: '$scannedAt' },
        lastScan: { $max: '$scannedAt' }
      }
    },
    { $project: {
        scanCount: 1,
        timeSpent: {
          $divide: [
            { $subtract: ['$lastScan', '$firstScan'] },
            1000 * 60 // Convert to minutes
          ]
        }
      }
    },
    { $group: {
        _id: null,
        avgScansPerClass: { $avg: '$scanCount' },
        avgTimeSpent: { $avg: '$timeSpent' },
        classes: { $sum: 1 }
      }
    }
  ]);

  // Dropout analysis - classes that started but didn't finish
  const dropoutAnalysis = await Class.aggregate([
    { $match: classDateFilter },
    { $lookup: {
        from: 'scans',
        localField: '_id',
        foreignField: 'classId',
        as: 'scans'
      }
    },
    { $project: {
        hasScans: { $gt: [{ $size: '$scans' }, 0] },
        isCompleted: 1,
        stationsScanned: { $size: '$stationsScanned' }
      }
    },
    { $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        classesWithScans: { $sum: { $cond: ['$hasScans', 1, 0] } },
        completedClasses: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        avgStationsScanned: { $avg: '$stationsScanned' }
      }
    }
  ]);

  // Peak usage times
  const peakUsage = await Scan.aggregate([
    { $match: scanDateFilter },
    { $group: {
        _id: {
          hour: { $hour: '$scannedAt' },
          dayOfWeek: { $dayOfWeek: '$scannedAt' }
        },
        scanCount: { $sum: 1 }
      }
    },
    { $sort: { scanCount: -1 } },
    { $limit: 10 }
  ]);

  // School participation
  const schoolParticipation = await Class.aggregate([
    { $match: classDateFilter },
    { $group: {
        _id: '$school',
        classCount: { $sum: 1 },
        totalStudents: { $sum: '$studentCount' },
        completedClasses: { $sum: { $cond: ['$isCompleted', 1, 0] } }
      }
    },
    { $project: {
        school: '$_id',
        classCount: 1,
        totalStudents: 1,
        completedClasses: 1,
        completionRate: {
          $round: [
            { $multiply: [{ $divide: ['$completedClasses', '$classCount'] }, 100] },
            1
          ]
        },
        _id: 0
      }
    },
    { $sort: { totalStudents: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      scanVelocity: scanVelocity[0] || { avgScansPerClass: 0, avgTimeSpent: 0, classes: 0 },
      dropoutAnalysis: dropoutAnalysis[0] || { totalClasses: 0, classesWithScans: 0, completedClasses: 0, avgStationsScanned: 0 },
      peakUsage,
      schoolParticipation
    }
  });
});

// @desc    Get historical comparison data
// @route   GET /api/analytics/historical
// @access  Private/Admin
const getHistoricalData = asyncHandler(async (req, res, next) => {
  const { compareYears = 2 } = req.query;
  
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i < compareYears; i++) {
    years.push(currentYear - i);
  }

  const historicalData = [];
  
  for (const year of years) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    
    const yearData = await Class.aggregate([
      { $match: { registeredAt: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          completedClasses: { $sum: { $cond: ['$isCompleted', 1, 0] } },
          totalStudents: { $sum: '$studentCount' },
          avgStudentsPerClass: { $avg: '$studentCount' }
        }
      }
    ]);

    const scanData = await Scan.aggregate([
      { $match: { scannedAt: { $gte: startOfYear, $lte: endOfYear } } },
      { $group: {
          _id: null,
          totalScans: { $sum: 1 }
        }
      }
    ]);

    historicalData.push({
      year,
      ...yearData[0] || { totalClasses: 0, completedClasses: 0, totalStudents: 0, avgStudentsPerClass: 0 },
      totalScans: scanData[0]?.totalScans || 0,
      completionRate: yearData[0] ? Math.round((yearData[0].completedClasses / yearData[0].totalClasses) * 100) : 0
    });
  }

  res.status(200).json({
    success: true,
    data: historicalData
  });
});

module.exports = {
  getAnalyticsOverview,
  getStationHeatmap,
  getTimePatterns,
  getEngagementMetrics,
  getHistoricalData
};