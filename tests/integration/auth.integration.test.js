const request = require('supertest');
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('../../config/db'); // To ensure DB is connected via setup
const User = require('../../models/User');

// We need to set up a minimal app or import the main app
// For simplicity, let's import the main app.
// Ensure your app.js or server.js exports the app for testing.

// Modify server.js to export app for testing
/*
In server.js, at the end:
...
const server = app.listen(PORT, () => { ... });
module.exports = { app, server }; // Export app and server

Then in your test:
const { app, server } = require('../../server'); // Adjust path
afterAll(done => { server.close(done); }); // Close server after tests
*/

// For now, let's assume server.js exports app
// If server.js directly calls app.listen, it's harder to test without it starting.
// A common pattern is to have app.js define the app and server.js import and start it.
// Let's assume your main server file (e.g. server.js or app.js) exports the app instance.
// If not, you'll need to refactor it. For example, in server.js:
// ...
// const app = express();
// ...
// module.exports = app; // Export app at the end (if not starting server in this file)
// OR if server.js starts the server:
// const serverInstance = app.listen(...); module.exports = { app, serverInstance };
// For this example, I'll assume `server.js` is structured to export `app` before `app.listen`
// or that you have an `app.js` that exports the app.

// Let's assume your server.js is modified to export the app instance
// For example, at the end of server.js:
// if (process.env.NODE_ENV !== 'test') {
//   app.listen(PORT, () => logger.info(`Server running...`));
// }
// module.exports = app;

// --- This is a simplified setup for the app for testing ---
// In a real scenario, you'd import your actual configured Express app
let app;

beforeAll(async () => {
    // Dynamically import app after env is set by setup.js
    // This ensures app uses test environment variables
    app = require('../../server').app; // Assuming server.js exports { app, server }
});


describe('Auth API', () => {
  const testUser = {
    name: 'Test User',
    email: 'testuser@example.com',
    password: 'password123',
    school: 'Test School',
    role: 'teacher',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', testUser.email);

      // Check if user is in the database
      const userInDb = await User.findOne({ email: testUser.email });
      expect(userInDb).not.toBeNull();
      expect(userInDb.name).toBe(testUser.name);
    });

    it('should return 400 if email already exists', async () => {
      await User.create(testUser); // Pre-populate user
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);
      expect(res.statusCode).toEqual(400); // Mongoose duplicate key error
      expect(res.body).toHaveProperty('success', false);
      // The error message might vary based on your errorHandler
      expect(res.body.error).toContain('Duplicate field value entered');
    });

    it('should return 400 for missing fields', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: 'Test' }); // Missing email, password
        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toBe(false);
        // Error message depends on Mongoose validation
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user to login with
      const user = new User(testUser);
      await user.save();
    });

    it('should login an existing user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should return 401 for invalid credentials (wrong password)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' });
      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nouser@example.com', password: 'password123' });
      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      token = loginRes.body.token;
    });

    it('should get current user details with a valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
    });

    it('should return 401 if no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toEqual(401);
    });
  });
});