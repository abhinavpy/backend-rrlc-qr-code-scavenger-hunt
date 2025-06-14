const classController = require('../../controllers/classController');
const Class = require('../../models/Class');
const Scan = require('../../models/Scan');
const Station = require('../../models/Station');
const ErrorResponse = require('../../utils/errorResponse');

jest.mock('../../models/Class');
jest.mock('../../models/Scan');
jest.mock('../../models/Station');

describe('Class Controller - Unit Tests', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      body: {},
      user: { id: 'teacherUserId', name: 'Test Teacher', email: 'teacher@test.com', role: 'teacher' },
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

  describe('createClass', () => {
    it('should create a class successfully', async () => {
      mockRequest.body = { name: 'New Class', school: 'Test School', grade: '6th', studentCount: 20 };
      const mockCreatedClass = { _id: 'classId123', ...mockRequest.body, teacher: { _id: 'teacherUserId', name: 'Test Teacher', email: 'teacher@test.com' } };
      Class.create.mockResolvedValue(mockCreatedClass);

      await classController.createClass(mockRequest, mockResponse, mockNext);

      expect(Class.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Class',
        teacher: { _id: 'teacherUserId', name: 'Test Teacher', email: 'teacher@test.com' }
      }));
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockCreatedClass });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('getClasses', () => {
    it('should get classes for a teacher', async () => {
      const mockClasses = [{ name: 'Class 1' }, { name: 'Class 2' }];
      Class.find.mockResolvedValue(mockClasses);

      await classController.getClasses(mockRequest, mockResponse, mockNext);

      expect(Class.find).toHaveBeenCalledWith({ 'teacher._id': 'teacherUserId' });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, count: mockClasses.length, data: mockClasses });
    });

    it('should get all classes for an admin', async () => {
      mockRequest.user.role = 'admin';
      const mockClasses = [{ name: 'Class 1' }, { name: 'Class 2' }, { name: 'Class 3' }];
      Class.find.mockResolvedValue(mockClasses);

      await classController.getClasses(mockRequest, mockResponse, mockNext);

      expect(Class.find).toHaveBeenCalledWith(); // No filter for admin
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, count: mockClasses.length, data: mockClasses });
    });
  });

  describe('getClass', () => {
    it('should get a single class if user is owner', async () => {
      mockRequest.params.id = 'classId123';
      const mockClass = { _id: 'classId123', name: 'Test Class', teacher: { _id: 'teacherUserId' } };
      Class.findById.mockResolvedValue(mockClass);

      await classController.getClass(mockRequest, mockResponse, mockNext);

      expect(Class.findById).toHaveBeenCalledWith('classId123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockClass });
    });

    it('should return 404 if class not found', async () => {
      mockRequest.params.id = 'nonExistentClassId';
      Class.findById.mockResolvedValue(null);

      await classController.getClass(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('should return 403 if user is not owner and not admin', async () => {
      mockRequest.params.id = 'classId123';
      const mockClass = { _id: 'classId123', name: 'Test Class', teacher: { _id: 'otherTeacherId' } };
      Class.findById.mockResolvedValue(mockClass);

      await classController.getClass(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('updateClass', () => {
    it('should update a class if user is owner', async () => {
        mockRequest.params.id = 'classId123';
        mockRequest.body = { name: 'Updated Class Name' };
        const mockExistingClass = { _id: 'classId123', name: 'Old Name', teacher: { _id: 'teacherUserId' } };
        const mockUpdatedClass = { ...mockExistingClass, ...mockRequest.body };

        Class.findById.mockResolvedValue(mockExistingClass);
        Class.findByIdAndUpdate.mockResolvedValue(mockUpdatedClass);

        await classController.updateClass(mockRequest, mockResponse, mockNext);

        expect(Class.findById).toHaveBeenCalledWith('classId123');
        expect(Class.findByIdAndUpdate).toHaveBeenCalledWith('classId123', { name: 'Updated Class Name' }, { new: true, runValidators: true });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockUpdatedClass });
    });

    it('should not allow updating classCode', async () => {
        mockRequest.params.id = 'classId123';
        mockRequest.body = { name: 'Updated Class Name', classCode: 'NEWCODE' }; // Attempt to update classCode
        const mockExistingClass = { _id: 'classId123', name: 'Old Name', teacher: { _id: 'teacherUserId' } };
        Class.findById.mockResolvedValue(mockExistingClass);
        Class.findByIdAndUpdate.mockResolvedValue({}); // Actual value doesn't matter as much as the call

        await classController.updateClass(mockRequest, mockResponse, mockNext);

        expect(Class.findByIdAndUpdate).toHaveBeenCalledWith('classId123', { name: 'Updated Class Name' }, { new: true, runValidators: true }); // classCode should be removed
    });
  });

  describe('getClassProgress', () => {
    it('should get class progress correctly', async () => {
        mockRequest.params.id = 'classId123';
        const mockClassObj = { _id: 'classId123', name: 'Progress Class', teacher: { _id: 'teacherUserId' } };
        const mockStations = [{ _id: 'station1' }, { _id: 'station2' }, { _id: 'station3' }];
        const mockScans = [
            { station: 'station1', scannedAt: new Date('2023-01-01T10:00:00Z') },
            { station: 'station2', scannedAt: new Date('2023-01-01T10:05:00Z') }
        ];

        Class.findById.mockResolvedValue(mockClassObj);
        Station.find.mockResolvedValue(mockStations);
        Scan.find.mockResolvedValue(mockScans);

        await classController.getClassProgress(mockRequest, mockResponse, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                classId: 'classId123',
                totalStations: 3,
                completedCount: 2,
                progressPercentage: (2/3) * 100,
                isCompleted: false,
                startTime: new Date('2023-01-01T10:00:00Z'),
                endTime: null, // Not completed
            })
        }));
    });

     it('should calculate endTime and completionTime if all stations completed', async () => {
        mockRequest.params.id = 'classId123';
        const mockClassObj = { _id: 'classId123', name: 'Completed Class', teacher: { _id: 'teacherUserId' } };
        const mockStations = [{ _id: 'station1' }, { _id: 'station2' }];
        const mockScans = [
            { station: 'station1', scannedAt: new Date('2023-01-01T10:00:00Z') },
            { station: 'station2', scannedAt: new Date('2023-01-01T10:05:00Z') },
            { station: 'station1', scannedAt: new Date('2023-01-01T10:02:00Z') }, // Duplicate scan, different time
        ];

        Class.findById.mockResolvedValue(mockClassObj);
        Station.find.mockResolvedValue(mockStations);
        Scan.find.mockResolvedValue(mockScans);

        await classController.getClassProgress(mockRequest, mockResponse, mockNext);
        
        const expectedStartTime = new Date('2023-01-01T10:00:00Z');
        const expectedEndTime = new Date('2023-01-01T10:05:00Z'); // Last unique scan
        const expectedCompletionTime = (expectedEndTime.getTime() - expectedStartTime.getTime()) / (1000 * 60);


        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                totalStations: 2,
                completedCount: 2,
                progressPercentage: 100,
                isCompleted: true,
                startTime: expectedStartTime,
                endTime: expectedEndTime,
                completionTime: expectedCompletionTime,
            })
        }));
    });
  });
});