const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Class = require('../models/Class');
const Station = require('../models/Station');
const ErrorResponse = require('../utils/errorResponse'); // Assuming you have this

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getAdminStats = asyncHandler(async (req, res) => {
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalClasses = await Class.countDocuments({ isActive: true });
    const activeStations = await Station.countDocuments({ isActive: true });
    const completedHunts = await Class.countDocuments({ isCompleted: true, isActive: true });

    res.status(200).json({
        success: true,
        data: {
            totalTeachers,
            totalClasses,
            activeStations,
            completedHunts,
        },
    });
});

// @desc    Get recent class activity for admin dashboard
// @route   GET /api/admin/recent-activity
// @access  Private/Admin
const getRecentAdminActivity = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items
    const totalActiveStations = await Station.countDocuments({ isActive: true });

    const recentClasses = await Class.find({ isActive: true })
        .populate('teacher._id', 'name email')
        .sort({ lastScanAt: -1, registeredAt: -1 })
        .limit(limit);

    const activityData = recentClasses.map(cls => {
        const scannedCount = cls.stationsScanned ? cls.stationsScanned.length : 0;
        const progressPercentage = totalActiveStations > 0 ? Math.round((scannedCount / totalActiveStations) * 100) : 0;
        
        return {
            _id: cls._id,
            className: cls.name,
            teacherName: cls.teacher && cls.teacher.name ? cls.teacher.name : 'N/A',
            school: cls.school,
            progress: {
                completedCount: scannedCount,
                totalStations: totalActiveStations,
                progressPercentage
            },
            lastScanAt: cls.lastScanAt,
            isCompleted: cls.isCompleted,
            completedAt: cls.completedAt
        };
    });

    res.status(200).json({
        success: true,
        count: activityData.length,
        data: activityData,
    });
});

// @desc    Get all teachers
// @route   GET /api/admin/teachers-list
// @access  Private/Admin
const getAllTeachers = asyncHandler(async (req, res, next) => {
    const teachers = await User.find({ role: 'teacher' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        count: teachers.length,
        data: teachers
    });
});

// @desc    Get all classes for admin
// @route   GET /api/admin/all-classes
// @access  Private/Admin
const getAllClassesForAdmin = asyncHandler(async (req, res, next) => {
    const totalActiveStations = await Station.countDocuments({ isActive: true });
    
    const classes = await Class.find()
        .populate('teacher._id', 'name email')
        .sort({ registeredAt: -1 });

    const classesWithProgress = classes.map(cls => {
        const scannedCount = cls.stationsScanned ? cls.stationsScanned.length : 0;
        const progressPercentage = totalActiveStations > 0 ? Math.round((scannedCount / totalActiveStations) * 100) : 0;
        
        return {
            _id: cls._id,
            name: cls.name,
            school: cls.school,
            grade: cls.grade,
            studentCount: cls.studentCount,
            teacher: cls.teacher,
            isActive: cls.isActive,
            isCompleted: cls.isCompleted,
            completedAt: cls.completedAt,
            lastScanAt: cls.lastScanAt,
            registeredAt: cls.registeredAt,
            progress: {
                completedCount: scannedCount,
                totalStations: totalActiveStations,
                progressPercentage
            }
        };
    });

    res.status(200).json({
        success: true,
        count: classesWithProgress.length,
        data: classesWithProgress
    });
});

// @desc    Get all completed hunts (classes)
// @route   GET /api/admin/completed-hunts
// @access  Private/Admin
const getCompletedHuntsList = asyncHandler(async (req, res, next) => {
    const totalActiveStations = await Station.countDocuments({ isActive: true });
    
    const completedHunts = await Class.find({ isCompleted: true, isActive: true })
        .populate('teacher._id', 'name email')
        .sort({ completedAt: -1 }); // Sort by completion time

    const huntsWithDetails = completedHunts.map(cls => {
        const scannedCount = cls.stationsScanned ? cls.stationsScanned.length : 0;
        
        return {
            _id: cls._id,
            name: cls.name,
            school: cls.school,
            grade: cls.grade,
            studentCount: cls.studentCount,
            teacher: cls.teacher,
            completedAt: cls.completedAt,
            lastScanAt: cls.lastScanAt,
            registeredAt: cls.registeredAt,
            stationsScanned: scannedCount,
            totalStations: totalActiveStations,
            completionTime: cls.completedAt && cls.registeredAt ? 
                Math.round((new Date(cls.completedAt) - new Date(cls.registeredAt)) / (1000 * 60 * 60)) : null // hours
        };
    });

    res.status(200).json({
        success: true,
        count: huntsWithDetails.length,
        data: huntsWithDetails
    });
});

module.exports = {
    getAdminStats,
    getRecentAdminActivity,
    getAllTeachers,
    getAllClassesForAdmin,
    getCompletedHuntsList
};