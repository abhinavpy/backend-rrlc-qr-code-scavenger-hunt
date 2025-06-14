const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }
  // Set token from cookie (if you use cookies)
  // else if (req.cookies.token) {
  //   token = req.cookies.token;
  // }

  // Make sure token exists
  if (!token) {
    logger.error('No token, authorization denied');
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password'); // Exclude password

    if (!req.user) {
      logger.error(`User not found with id: ${decoded.id}`);
      return next(new ErrorResponse('No user found with this id', 404));
    }
    next();
  } catch (err) {
    logger.error(`Token verification failed: ${err.message}`);
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// Grant access to specific roles
exports.authorize = (...rolesInput) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      logger.error('User or user role not found on request object in authorize middleware');
      return next(
        new ErrorResponse(`User role not available for authorization check`, 403)
      );
    }

    // Flatten rolesInput in case it's an array of arrays (e.g., authorize(['admin', 'editor']))
    // or just an array of roles (e.g., authorize('admin', 'editor'))
    const allowedRoles = [].concat(...rolesInput); // Flattens one level

    const userRole = req.user.role.trim(); // Trim user role once

    console.log('--- AUTHORIZE DEBUG ---');
    console.log(`User Role (trimmed): '${userRole}'`);
    console.log('Allowed Roles (flattened and trimmed):', allowedRoles.map(r => String(r).trim())); // Ensure elements are strings and trim

    let isAuthorized = false;
    for (const allowedRole of allowedRoles) {
      if (String(allowedRole).trim() === userRole) {
        isAuthorized = true;
        break;
      }
    }
    
    console.log(`Is Authorized: ${isAuthorized}`);
    console.log('--- END AUTHORIZE DEBUG ---');

    if (!isAuthorized) {
      logger.error(`User role '${req.user.role}' is not authorized. Allowed: ${allowedRoles.join(', ')}`);
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};