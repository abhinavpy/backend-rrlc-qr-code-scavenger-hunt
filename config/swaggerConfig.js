const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0', // Specification (optional, defaults to swagger: '2.0')
    info: {
      title: 'QR Scavenger Hunt API',
      version: '1.0.0',
      description: 'API documentation for the QR Scavenger Hunt application',
      contact: {
        name: 'Your Name/Team',
        email: 'your.email@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}/api`,
        description: 'Development server',
      },
      // You can add more servers (e.g., staging, production)
    ],
    components: {
      securitySchemes: {
        bearerAuth: { // Arbitrary name for the security scheme
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT', // Optional, for documentation purposes
        },
      },
    },
    security: [ // Apply bearerAuth globally to all operations
      {
        bearerAuth: [],
      },
    ],
  },
  // Path to the API docs
  // Looks for JSDoc comments in these files
  apis: ['./routes/*.js', './controllers/*.js', './models/*.js'], // Adjust paths as needed
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;