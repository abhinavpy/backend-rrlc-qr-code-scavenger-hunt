const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./utils/errorHandler');
const cors = require('cors'); // Import CORS
const rateLimit = require('express-rate-limit'); // 1. Import express-rate-limit

// Load environment variables first
dotenv.config();

// --- Swagger Setup ---
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swaggerConfig');

// Connect to database
connectDB();

const app = express();

// 1.1 (Optional but Recommended for Proxies like Vercel/Render/Nginx)
// If your app is behind a reverse proxy, trust the first proxy
// This helps in getting the correct client IP for rate limiting
app.set('trust proxy', 1);


// --- Rate Limiting Setup ---
// 2. Define your rate limiters

// General API limiter (e.g., for most GET requests)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `windowMs`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP for general API access, please try again after 15 minutes.',
});

// Stricter limiter for sensitive actions like POST, PUT, DELETE
const sensitiveActionsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // Limit each IP to 50 sensitive actions per `windowMs`
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many sensitive actions from this IP, please try again after 10 minutes.',
});

// Even stricter limiter for authentication attempts
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 auth attempts (login/register) per `windowMs`
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts from this IP, please try again after 5 minutes.',
  // skipSuccessfulRequests: true, // Optional: if you don't want successful logins to count
});


// Middleware
require('./config/middleware')(app); // This likely includes express.json(), etc.

// --- CORS Configuration ---
// Define allowed origins.
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server (adjust port if different)
  'http://localhost:3000', // Common React dev server port
  'https://frontend-rrlc-qr-scavenger-hunt.vercel.app', // Placeholder for your Vercel URL
  'https://frontend-rrlc-qr-scavenger-hunt.vercel.app/', // Placeholder for your Vercel URL with trailing slash
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // If you need to handle cookies or authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
// --- End CORS Configuration ---


// --- Swagger UI Route ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'QR Scavenger Hunt API Docs'
}));

// 3. Apply Rate Limiters to Routes

// Apply authLimiter specifically to auth routes
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));

// For other routes, you can decide:
// Option A: Apply a general limiter to all remaining /api routes
// app.use('/api', generalApiLimiter); // Place this before individual /api routes if you want a catch-all for /api

// Option B: Apply specific limiters to route groups
// For example, GET requests might use generalApiLimiter, while POST/PUT/DELETE use sensitiveActionsLimiter.
// This requires modifying how you apply middleware in your route files or here.
// For simplicity, let's apply `sensitiveActionsLimiter` to routes that involve data modification
// and `generalApiLimiter` to routes that are mostly for reading data.

// Example of applying different limiters:
// Note: If a route file handles both GET and POST/PUT, applying a single limiter here is simpler.
// Or, you can apply limiters inside the route files themselves for more granularity.

app.use('/api/classes', generalApiLimiter, require('./routes/classRoutes')); // Mostly GET, but has POST/PUT
app.use('/api/stations', generalApiLimiter, require('./routes/stationRoutes')); // Mostly GET, but has POST/PUT/DELETE
app.use('/api/scans', sensitiveActionsLimiter, require('./routes/scanRoutes')); // `recordScan` is a POST
app.use('/api/drawings', sensitiveActionsLimiter, require('./routes/drawingRoutes')); // Admin actions, mostly POST
app.use('/api/analytics', generalApiLimiter, require('./routes/analyticsRoutes')); // Admin GET requests
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', generalApiLimiter, adminRoutes); // Admin GET requests

// Health check endpoint - generally good to have a very lenient or no rate limit
const healthLimiter = rateLimit({ windowMs: 60 * 1000, max: 50 }); // Lenient: 50 req per min
app.get('/api/health', healthLimiter, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`📚 API Documentation available at: http://localhost:${PORT}/api-docs`);
  }
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`❌ Unhandled Promise Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`❌ Uncaught Exception: ${err.message}`);
  console.log('Shutting down the server due to uncaught exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('💤 Process terminated');
  });
});