const express = require('express');
const router = express.Router();
// Corrected path to auth middleware
const { protect, authorize } = require('../middlewares/auth'); 
const { getAdminStats, getRecentAdminActivity, getAllTeachers, getAllClassesForAdmin, getCompletedHuntsList } = require('../controllers/adminController');

// All routes in this file will be protected and require admin role
router.use(protect);
router.use(authorize(['admin']));

router.get('/stats', getAdminStats);
router.get('/recent-activity', getRecentAdminActivity);

// Add new list routes
router.get('/teachers-list', getAllTeachers);
router.get('/all-classes', getAllClassesForAdmin);
router.get('/completed-hunts', getCompletedHuntsList);


module.exports = router;