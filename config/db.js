/**
 * MongoDB Database Connection Configuration
 * 
 * This file establishes a connection to MongoDB using Mongoose.
 * It exports a function that can be called when the server starts.
 */

const mongoose = require('mongoose'); // Import Mongoose ODM
const logger = require('../utils/logger'); // Import custom logger utility

/**
 * Connects to MongoDB database using environment variables
 * @async
 * @returns {Promise<void>}
 */
const connectDB = async (uri) => { // Allow passing a URI
  try {
    const mongoUri = uri || process.env.MONGO_URI; // Use passed URI or fallback to env
    if (!mongoUri) {
      throw new Error('MongoDB URI not found. Please set MONGO_URI or pass a URI to connectDB.');
    }
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,     // Use new URL parser to avoid deprecation warnings
      useUnifiedTopology: true,  // Use new server discovery and monitoring engine
    });

    // Log successful connection with the host information
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Log any connection errors
    logger.error(`Error: ${error.message}`);
    // Exit process with failure code if database connection fails
    process.exit(1);
  }
};

module.exports = connectDB; // Export the connection function