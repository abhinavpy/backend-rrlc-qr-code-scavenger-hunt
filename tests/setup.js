const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  // You might want to set process.env.MONGO_URI here if your app reads it directly
  // However, it's better if your db.js can accept a URI or defaults to process.env
  process.env.MONGO_URI_TEST = mongoUri; // Store for potential direct use
  process.env.JWT_SECRET = 'testsecret'; // Use a fixed secret for tests
  process.env.NODE_ENV = 'test';
});

afterEach(async () => {
  // Clean up the database after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});