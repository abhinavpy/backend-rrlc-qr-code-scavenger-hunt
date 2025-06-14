const express = require('express');
const {
  getClasses,
  createClass,
  updateClass,
  getClassDetails,
  getClassProgress,
  getClass
} = require('../controllers/classController');

const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getClasses)
  .post(createClass);

// Important: Put more specific routes BEFORE the generic /:id route
router.route('/:id/details')
  .get(getClassDetails);

router.route('/:id/progress')
  .get(getClassProgress);

router.route('/:id')
  .get(getClass)
  .put(updateClass);

module.exports = router;