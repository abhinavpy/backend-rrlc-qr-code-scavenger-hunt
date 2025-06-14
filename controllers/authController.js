const User = require('../models/User');
const asyncHandler = require('../middlewares/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     description: Creates a new user account and returns a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name.
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address.
 *                 example: teacher@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: User's password.
 *                 example: password123
 *               school:
 *                 type: string
 *                 description: School name (required for teachers).
 *                 example: Eureka Elementary
 *               role:
 *                 type: string
 *                 enum: [teacher, admin]
 *                 default: teacher
 *                 description: User role.
 *                 example: teacher
 *     responses:
 *       201:
 *         description: Registration successful, returns JWT token and user info.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       400:
 *         description: Invalid input or validation errors.
 *       409:
 *         description: User already exists with this email.
 *     security: [] # Override global security for this public endpoint
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, school, role } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return next(new ErrorResponse('Please provide name, email, and password', 400));
  }

  // For teachers, school is required
  if (role === 'teacher' && !school) {
    return next(new ErrorResponse('School is required for teacher registration', 400));
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorResponse('User already exists with this email', 409));
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    school: role === 'teacher' ? school : undefined, // Only include school for teachers
    role: role || 'teacher' // Default to teacher if role not specified
  });

  sendTokenResponse(user, 201, res);
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     description: Authenticates a user and returns a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address.
 *                 example: teacher@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's password.
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token and user info.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       400:
 *         description: Invalid input, missing email or password.
 *       401:
 *         description: Invalid credentials.
 *     security: [] # Override global security for this public endpoint
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Update last login time
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     description: Update current user's profile information (excluding email and password).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *                 example: Jane Doe
 *               school:
 *                 type: string
 *                 description: School name (for teachers)
 *                 example: Lincoln Elementary
 *               profilePicture:
 *                 type: string
 *                 description: URL to profile picture
 *                 example: https://example.com/profile.jpg
 *               bio:
 *                 type: string
 *                 description: User bio/description
 *                 example: 5th grade teacher with 10 years experience
 *               phone:
 *                 type: string
 *                 description: Phone number
 *                 example: (555) 123-4567
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     school:
 *                       type: string
 *                     profilePicture:
 *                       type: string
 *                     bio:
 *                       type: string
 *                     phone:
 *                       type: string
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Not authenticated
 *     security:
 *       - bearerAuth: []
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { name, school, profilePicture, bio, phone } = req.body;

  // Fields that can be updated
  const fieldsToUpdate = {};
  if (name) fieldsToUpdate.name = name;
  if (school !== undefined) fieldsToUpdate.school = school; // Allow empty string
  if (profilePicture !== undefined) fieldsToUpdate.profilePicture = profilePicture; // Allow empty string to remove picture
  if (bio !== undefined) fieldsToUpdate.bio = bio;
  if (phone !== undefined) fieldsToUpdate.phone = phone;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    fieldsToUpdate,
    {
      new: true,
      runValidators: true
    }
  );

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      school: user.school,
      profilePicture: user.profilePicture,
      bio: user.bio,
      phone: user.phone
    }
  });
});

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      school: user.school
    }
  });
};