const stationController = require('../../controllers/stationController');
const Station = require('../../models/Station');
const QRCode = require('qrcode');
const ErrorResponse = require('../../utils/errorResponse');

jest.mock('../../models/Station');
jest.mock('qrcode');

describe('Station Controller - Unit Tests', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      body: {},
      user: { id: 'adminUserId', role: 'admin' }, // Assume admin for creation/update
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    process.env.FRONTEND_URL = 'http://localhost:3000'; // Mock env var
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStation', () => {
    it('should create a station successfully', async () => {
      mockRequest.body = { name: 'New Station', description: 'A cool station' };
      const mockCreatedStation = { _id: 'stationId123', ...mockRequest.body };
      Station.create.mockResolvedValue(mockCreatedStation);

      await stationController.createStation(mockRequest, mockResponse, mockNext);

      expect(Station.create).toHaveBeenCalledWith(mockRequest.body);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockCreatedStation });
    });
  });

  describe('getStations', () => {
    it('should get all stations', async () => {
      const mockStations = [{ name: 'Station A' }, { name: 'Station B' }];
      Station.find.mockResolvedValue(mockStations);

      await stationController.getStations(mockRequest, mockResponse, mockNext);

      expect(Station.find).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, count: mockStations.length, data: mockStations });
    });
  });

  describe('getStation', () => {
    it('should get a single station by ID', async () => {
        mockRequest.params.id = 'stationId123';
        const mockStation = { _id: 'stationId123', name: 'Specific Station' };
        Station.findById.mockResolvedValue(mockStation);

        await stationController.getStation(mockRequest, mockResponse, mockNext);

        expect(Station.findById).toHaveBeenCalledWith('stationId123');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockStation });
    });

    it('should return 404 if station not found', async () => {
        mockRequest.params.id = 'notFoundId';
        Station.findById.mockResolvedValue(null);
        await stationController.getStation(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.any(ErrorResponse));
        expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe('updateStation', () => {
    it('should update a station successfully', async () => {
        mockRequest.params.id = 'stationIdToUpdate';
        mockRequest.body = { description: 'Updated Description' };
        const mockExistingStation = { _id: 'stationIdToUpdate', name: 'Old Station' };
        const mockUpdatedStation = { ...mockExistingStation, ...mockRequest.body };

        Station.findById.mockResolvedValue(mockExistingStation);
        Station.findByIdAndUpdate.mockResolvedValue(mockUpdatedStation);

        await stationController.updateStation(mockRequest, mockResponse, mockNext);

        expect(Station.findById).toHaveBeenCalledWith('stationIdToUpdate');
        expect(Station.findByIdAndUpdate).toHaveBeenCalledWith('stationIdToUpdate', { description: 'Updated Description' }, { new: true, runValidators: true });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: mockUpdatedStation });
    });

    it('should not allow updating qrCode field', async () => {
        mockRequest.params.id = 'stationIdToUpdate';
        mockRequest.body = { description: 'Updated Description', qrCode: 'newQR' }; // Attempt to update qrCode
        Station.findById.mockResolvedValue({ _id: 'stationIdToUpdate' });
        Station.findByIdAndUpdate.mockResolvedValue({});

        await stationController.updateStation(mockRequest, mockResponse, mockNext);
        expect(Station.findByIdAndUpdate).toHaveBeenCalledWith('stationIdToUpdate', { description: 'Updated Description' }, { new: true, runValidators: true });
    });
  });

  describe('generateQRCode', () => {
    it('should generate a QR code data URL for a station', async () => {
        mockRequest.params.id = 'stationIdForQR';
        const mockStation = { _id: 'stationIdForQR', name: 'QR Station', qrCode: 'uniqueStationQR123' };
        const mockQRDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';

        Station.findById.mockResolvedValue(mockStation);
        QRCode.toDataURL.mockResolvedValue(mockQRDataURL);

        await stationController.generateQRCode(mockRequest, mockResponse, mockNext);

        expect(Station.findById).toHaveBeenCalledWith('stationIdForQR');
        expect(QRCode.toDataURL).toHaveBeenCalledWith(`http://localhost:3000/scan/uniqueStationQR123`);
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            success: true,
            data: {
                stationId: 'stationIdForQR',
                stationName: 'QR Station',
                qrCode: 'uniqueStationQR123',
                qrCodeDataURL: mockQRDataURL
            }
        });
    });
  });
});