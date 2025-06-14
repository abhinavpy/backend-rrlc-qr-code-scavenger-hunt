const scanController = require('../../controllers/scanController');
const Scan = require('../../models/Scan');
const Station = require('../../models/Station');
const Class = require('../../models/Class');
const ErrorResponse = require('../../utils/errorResponse');

jest.mock('../../models/Scan');
jest.mock('../../models/Station');
jest.mock('../../models/Class');

describe('Scan Controller - Unit Tests', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      body: {},
      user: { id: 'userId', role: 'teacher' }, // Default user
      params: {},
      ip: '127.0.0.1'
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

  describe('recordScan', () => {
    it('should record a scan successfully', async () => {
      mockRequest.body = { classId: 'classId1', stationQRCode: 'qr123' };
      const mockStation = { _id: 'stationId1', name: 'Station Alpha', qrCode: 'qr123', isActive: true };
      const mockClass = { _id: 'classId1', name: 'Class Alpha', isActive: true };

      Station.findOne.mockResolvedValue(mockStation);
      Class.findById.mockResolvedValue(mockClass);
      Scan.findOne.mockResolvedValue(null); // No existing scan
      Scan.create.mockResolvedValue({}); // Mock successful creation

      await scanController.recordScan(mockRequest, mockResponse, mockNext);

      expect(Station.findOne).toHaveBeenCalledWith({ qrCode: 'qr123', isActive: true });
      expect(Class.findById).toHaveBeenCalledWith('classId1');
      expect(Scan.findOne).toHaveBeenCalledWith({ class: 'classId1', station: 'stationId1' });
      expect(Scan.create).toHaveBeenCalledWith(expect.objectContaining({
        class: 'classId1',
        station: 'stationId1'
      }));
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: `Scan recorded successfully for station: ${mockStation.name}!`,
        stationData: mockStation
      });
    });

    it('should return 400 if classId or stationQRCode is missing', async () => {
      mockRequest.body = { classId: 'classId1' }; // Missing stationQRCode
      await scanController.recordScan(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
      expect(mockNext.mock.calls[0][0].message).toBe('Please provide classId and stationQRCode');
    });

    it('should return 404 if station not found or not active', async () => {
      mockRequest.body = { classId: 'classId1', stationQRCode: 'qrNonExistent' };
      Station.findOne.mockResolvedValue(null);
      await scanController.recordScan(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('should return 400 if station already scanned by class', async () => {
      mockRequest.body = { classId: 'classId1', stationQRCode: 'qr123' };
      Station.findOne.mockResolvedValue({ _id: 'stationId1', name: 'Station Alpha', isActive: true });
      Class.findById.mockResolvedValue({ _id: 'classId1', name: 'Class Alpha', isActive: true });
      Scan.findOne.mockResolvedValue({ _id: 'existingScanId' }); // Existing scan found

      await scanController.recordScan(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
      expect(mockNext.mock.calls[0][0].message).toContain('already scanned by class');
    });
  });

  describe('getScansByClass', () => {
    it('should get scans for a class if user is owner', async () => {
        mockRequest.params.classId = 'classId1';
        // Teacher user is owner of classId1
        const mockClassObj = { _id: 'classId1', teacher: { _id: 'userId' } };
        const mockScans = [{ _id: 'scan1' }, { _id: 'scan2' }];

        Class.findById.mockResolvedValue(mockClassObj);
        Scan.find = jest.fn().mockReturnValue({ // Mock chained populate
            populate: jest.fn().mockResolvedValue(mockScans)
        });

        await scanController.getScansByClass(mockRequest, mockResponse, mockNext);

        expect(Class.findById).toHaveBeenCalledWith('classId1');
        expect(Scan.find).toHaveBeenCalledWith({ class: 'classId1' });
        expect(Scan.find().populate).toHaveBeenCalledWith('station', 'name educationalInfo');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, count: mockScans.length, data: mockScans });
    });

    it('should return 403 if user is not owner of class and not admin', async () => {
        mockRequest.params.classId = 'classId1';
        const mockClassObj = { _id: 'classId1', teacher: { _id: 'otherTeacherId' } }; // Different teacher
        Class.findById.mockResolvedValue(mockClassObj);

        await scanController.getScansByClass(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
        expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('getScansByStation', () => {
    // This route is admin only, so the default mockRequest.user.role = 'admin' would be needed
    // or set it specifically in the test.
    it('should get scans for a station (admin only)', async () => {
        mockRequest.user.role = 'admin'; // Ensure admin for this test
        mockRequest.params.stationId = 'stationId1';
        const mockStationObj = { _id: 'stationId1' };
        const mockScans = [{ _id: 'scanA' }, { _id: 'scanB' }];

        Station.findById.mockResolvedValue(mockStationObj);
        Scan.find = jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockScans)
        });

        await scanController.getScansByStation(mockRequest, mockResponse, mockNext);

        expect(Station.findById).toHaveBeenCalledWith('stationId1');
        expect(Scan.find).toHaveBeenCalledWith({ station: 'stationId1' });
        expect(Scan.find().populate).toHaveBeenCalledWith('class', 'name school');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, count: mockScans.length, data: mockScans });
    });
  });
});