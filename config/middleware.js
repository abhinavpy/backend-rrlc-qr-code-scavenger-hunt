/**
 * Express Middleware Configuration
 * 
 * This file centralizes all middleware setup for the Express application.
 * It configures body parsing, security features, logging, and CORS settings.
 */

const express = require('express'); // Import Express framework
const cors = require('cors');       // Import Cross-Origin Resource Sharing middleware
const helmet = require('helmet');   // Import security headers middleware
const morgan = require('morgan');   // Import HTTP request logger middleware

/**
 * Sets up all middleware for the Express application
 * @param {Object} app - Express application instance
 */
const setupMiddleware = (app) => {
  // Body parser middleware - Parses incoming JSON requests
  app.use(express.json());
  
  // CORS middleware - Enables cross-origin requests from the frontend
  app.use(cors());
  
  // Helmet middleware - Sets various HTTP headers for app security
  app.use(helmet());
  
  // Morgan logger - Logs HTTP requests in development environment only
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev')); // 'dev' format provides colored status codes
  }
};

module.exports = setupMiddleware; // Export middleware setup function