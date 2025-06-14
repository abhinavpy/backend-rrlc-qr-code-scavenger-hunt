const drawingController = require('../../controllers/drawingController');
const Drawing = require('../../models/Drawing');
const Class = require('../../models/Class');
const Station = require('../../models/Station');
const Scan = require('../../models/Scan');
const ErrorResponse = require('../../utils/errorResponse');
const emailService = require('../../services/emailService');

jest.mock('../../models/Drawing');
jest.mock('../../models/Class');
jest.mock('../../models/Station');
jest.mock('../../models/Scan');
jest.mock('../../services/emailService'); // Mock the email service

describe('Drawing Controller - Unit Tests', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      body: {},
      user: { id: 'adminUserId', role: 'admin' }, // Drawings are admin-only
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDrawing', () => {
    it('should create a drawing configuration', async () => {
      mockRequest.body = { name: 'Spring Raffle' };
      const mockDrawing = { _id: 'drawingId1', name: 'Spring Raffle', createdBy: 'adminUserId' };
      Drawing.create.mockResolvedValue(mockDrawing);

      await drawingController.createDrawing(mockRequest, mockResponse, mockNext);

      expect(Drawing.create).toHaveBeenCalledWith({ name: 'Spring Raffle', createdBy: 'adminUserId' });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockDrawing });
    });
  });

  describe('getDrawings', () => {
    it('should get all drawings', async () => {
      const mockDrawings = [{ name: 'Drawing 1' }, { name: 'Drawing 2' }];
      Drawing.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(), // First populate
        populate: jest.fn().mockResolvedValue(mockDrawings) // Second populate
      });


      await drawingController.getDrawings(mockRequest, mockResponse, mockNext);

      expect(Drawing.find).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, count: mockDrawings.length, data: mockDrawings });
    });
  });

  describe('runDrawing', () => {
    // This is a complex function, so we'll test a simplified success path
    // and some key error conditions.
    it('should run a drawing and select winners if eligible classes exist', async () => {
        mockRequest.params.id = 'drawingIdToRun';
        mockRequest.body = { numberOfWinners: 1, prizeDescription: 'Pizza Party' };

        const mockDrawingDoc = {
            _id: 'drawingIdToRun',
            name: 'Test Draw',
            status: 'pending',
            eligibleClasses: [],
            winners: [],
            weightingFactors: { stationsFound: 0.1, completionTime: 0.05 },
            save: jest.fn().mockResolvedValue(true) // Mock the save method
        };
        Drawing.findById.mockResolvedValue(mockDrawingDoc);

        Station.find.mockResolvedValue([{ _id: 's1' }, { _id: 's2' }]); // 2 active stations
        const mockEligibleClass = {
            _id: 'class1', name: 'Winner Class', isActive: true,
            teacher: { _id: 'teacher1', name: 'Teacher One', email: 'teacher1@example.com' }
        };
        Class.find.mockResolvedValue([mockEligibleClass]); // One active class
        // This class found both stations
        Scan.find.mockResolvedValue([
            { station: 's1', scannedAt: new Date() },
            { station: 's2', scannedAt: new Date() }
        ]);
        emailService.sendEmail.mockResolvedValue({}); // Mock successful email send

        await drawingController.runDrawing(mockRequest, mockResponse, mockNext);

        expect(Drawing.findById).toHaveBeenCalledWith('drawingIdToRun');
        expect(mockDrawingDoc.save).toHaveBeenCalledTimes(2); // Once for eligible, once for winners/notified
        expect(mockDrawingDoc.status).toBe('completed');
        expect(mockDrawingDoc.winners.length).toBe(1);
        expect(mockDrawingDoc.winners[0].class.toString()).toBe('class1');
        expect(emailService.sendEmail).toHaveBeenCalled();
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ status: 'completed' }) });
    });

    it('should return 400 if no eligible classes', async () => {
        mockRequest.params.id = 'drawingIdToRun';
        mockRequest.body = { numberOfWinners: 1 };
        Drawing.findById.mockResolvedValue({ _id: 'drawingIdToRun', status: 'pending', save: jest.fn() });
        Station.find.mockResolvedValue([{ _id: 's1' }]); // 1 active station
        Class.find.mockResolvedValue([{ _id: 'class1', isActive: true }]);
        Scan.find.mockResolvedValue([]); // Class found 0 stations

        await drawingController.runDrawing(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
        expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
        expect(mockNext.mock.calls[0][0].message).toContain('No classes are eligible');
    });

    it('should return 409 if drawing already completed', async () => {
        mockRequest.params.id = 'completedDrawingId';
        mockRequest.body = { numberOfWinners: 1 };
        Drawing.findById.mockResolvedValue({ _id: 'completedDrawingId', status: 'completed' });

        await drawingController.runDrawing(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
        expect(mockNext.mock.calls[0][0].statusCode).toBe(409);
    });
  });
});