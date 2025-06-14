const authController = require('../../controllers/authController');
const User = require('../../models/User');
const ErrorResponse = require('../../utils/errorResponse');

// Mock the User model
jest.mock('../../models/User');
// Mock ErrorResponse if its constructor or methods are complex, or if you want to assert it was called correctly
// jest.mock('../../utils/errorResponse'); // Usually not needed if it's a simple class

describe('Auth Controller - Unit Tests', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      body: {},
      user: null, // For protected routes
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      // cookie: jest.fn().mockReturnThis(), // If you were using cookies
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a user and return a token', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        school: 'Test School',
      };

      const mockUserInstance = {
        _id: 'mockUserId',
        name: mockRequest.body.name,
        email: mockRequest.body.email,
        role: 'teacher',
        getSignedJwtToken: jest.fn().mockReturnValue('mockToken123'),
        // No need to mock matchPassword here as it's not called in register
      };
      User.create.mockResolvedValue(mockUserInstance);

      // Temporarily mock sendTokenResponse or replicate its logic if it's complex
      // For this example, let's assume sendTokenResponse is simple and part of the controller
      // If sendTokenResponse was imported, you'd mock it.
      // Since it's a local function in authController, we test its effect.

      await authController.register(mockRequest, mockResponse, mockNext);

      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        school: 'Test School',
        role: 'teacher', // Default role
      });
      expect(mockUserInstance.getSignedJwtToken).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        token: 'mockToken123',
        user: {
            id: 'mockUserId',
            name: 'Test User',
            email: 'test@example.com',
            role: 'teacher'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with an error if User.create fails', async () => {
      mockRequest.body = { name: 'Test', email: 'fail@example.com', password: '123' };
      const mockError = new Error('Database error');
      User.create.mockRejectedValue(mockError);

      await authController.register(mockRequest, mockResponse, mockNext);

      expect(User.create).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe('login', () => {
    it('should login a user and return a token', async () => {
        mockRequest.body = { email: 'test@example.com', password: 'password123' };
        const mockUser = {
            _id: 'userId123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'teacher',
            matchPassword: jest.fn().mockResolvedValue(true),
            getSignedJwtToken: jest.fn().mockReturnValue('mockToken'),
            save: jest.fn().mockResolvedValue(true) // Mock save for lastLogin update
        };
        User.findOne = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue(mockUser)
        });

        await authController.login(mockRequest, mockResponse, mockNext);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(mockUser.matchPassword).toHaveBeenCalledWith('password123');
        expect(mockUser.getSignedJwtToken).toHaveBeenCalled();
        expect(mockUser.save).toHaveBeenCalled(); // For lastLogin
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            token: 'mockToken'
        }));
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with ErrorResponse if email/password not provided', async () => {
        mockRequest.body = { email: 'test@example.com' }; // Missing password
        await authController.login(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
        expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        expect(mockNext.mock.calls[0][0].message).toBe('Please provide an email and password');
    });

     it('should call next with ErrorResponse if user not found', async () => {
        mockRequest.body = { email: 'nouser@example.com', password: 'password123' };
        User.findOne = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue(null)
        });
        await authController.login(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
        expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
        expect(mockNext.mock.calls[0][0].message).toBe('Invalid credentials');
    });

    it('should call next with ErrorResponse if password does not match', async () => {
        mockRequest.body = { email: 'test@example.com', password: 'wrongpassword' };
        const mockUser = {
            matchPassword: jest.fn().mockResolvedValue(false),
        };
         User.findOne = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue(mockUser)
        });
        await authController.login(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
        expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
        expect(mockNext.mock.calls[0][0].message).toBe('Invalid credentials');
    });
  });
});