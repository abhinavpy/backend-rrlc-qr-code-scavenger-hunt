/**
 * Environment Variable Configuration
 * 
 * This file loads environment variables and validates that required
 * variables are present. It centralizes environment configuration
 * to make the application more maintainable.
 */

// Load environment variables if not already loaded in server.js
require('dotenv').config();

// Define required environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_EXPIRE'
];

// Check for missing required variables
const missingEnvVars = requiredEnvVars.filter(
  envVar => !process.env[envVar]
);

// Throw error if any required variables are missing
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

// Export validated environment variables
module.exports = {
  // Server configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  
  // Database configuration
  MONGO_URI: process.env.MONGO_URI,
  
  // Authentication configuration
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '30d',
  
  // Frontend configuration (for CORS and QR code generation)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Email configuration (for winner notifications)
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'smtp',
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@qrscavengerhunt.com'
};