// functions/test/unit/cropService.test.js
const { updateCropData, getCropHistory } = require('../../src/services/crops/cropService');
const admin = require('firebase-admin');

// Define an object to hold mock functions that will be populated by the jest.mock factory
const mockFirebase = {
  transactionGet: jest.fn(),
  transactionUpdate: jest.fn(),
  transactionSet: jest.fn(),
  queryGet: jest.fn(), // For getCropHistory query.get()
  batchSet: jest.fn(),
  batchCommit: jest.fn().mockResolvedValue(undefined)
};

jest.mock('firebase-admin', () => {
  const mockTransactionInstance = {
    get: mockFirebase.transactionGet,
    update: mockFirebase.transactionUpdate,
    set: mockFirebase.transactionSet
  };

  const mockDocRef = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: mockFirebase.queryGet 
  };

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollectionRef),
    doc: jest.fn(() => mockDocRef),
    batch: jest.fn(() => ({
        set: mockFirebase.batchSet, 
        update: jest.fn(), // Add other batch methods if used by service
        delete: jest.fn(),
        commit: mockFirebase.batchCommit
    })),
    runTransaction: jest.fn(async (callback) => callback(mockTransactionInstance)),
    FieldValue: { serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP') }
  };

  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockFirestore),
  };
});

describe('Crop Service', () => {

  beforeEach(() => {
    // Clear all mocks held in the mockFirebase object
    mockFirebase.transactionGet.mockClear();
    mockFirebase.transactionUpdate.mockClear();
    mockFirebase.transactionSet.mockClear();
    mockFirebase.queryGet.mockClear();
    mockFirebase.batchSet.mockClear();
    mockFirebase.batchCommit.mockClear();
    
    // If admin.firestore() itself is a mock function, clear it too
    if (admin.firestore.mockClear) {
        admin.firestore.mockClear();
    }
    // If any methods on the direct result of admin.firestore() are mocks, clear them
    // This depends on how deep your direct admin.firestore() usage goes in the SUT
  });

  describe('updateCropData', () => {
    const farmerId = 'test-farmer-001';
    const newCrops = [{ type: 'wheat', acres: 500 }];
    const newTotalAcres = 500;
    const currentYear = 2025;

    test('should update crop data and create activity log for a new year', async () => {
      mockFirebase.transactionGet.mockResolvedValue({
        exists: true,
        data: () => ({ farmDetails: { crops: [], totalAcres: 0 } })
      });

      const result = await updateCropData(farmerId, newCrops, newTotalAcres, currentYear);

      expect(result.success).toBe(true);
      expect(mockFirebase.transactionGet).toHaveBeenCalledTimes(1);
      expect(mockFirebase.transactionUpdate).toHaveBeenCalledWith(expect.anything(), {
        'farmDetails.crops': newCrops,
        'farmDetails.totalAcres': newTotalAcres,
        'farmDetails.lastUpdated': 'MOCK_TIMESTAMP',
        'farmDetails.currentSeasonYear': currentYear,
        'metadata.lastActive': 'MOCK_TIMESTAMP'
      });
      expect(mockFirebase.transactionSet).toHaveBeenCalledTimes(1); 
      expect(mockFirebase.transactionSet.mock.calls[0][1]).toMatchObject({
        type: 'crop_data_updated',
        details: { yearUpdated: currentYear, cropCount: newCrops.length, newTotalAcres: newTotalAcres }
      });
    });

    test('should archive previous year crops if updating for a new year', async () => {
      const previousYear = 2024;
      const oldCrops = [{ type: 'barley', acres: 300 }];
      const oldTotalAcres = 300;
      mockFirebase.transactionGet.mockResolvedValue({
        exists: true,
        data: () => ({
          farmDetails: {
            crops: oldCrops,
            totalAcres: oldTotalAcres,
            lastUpdated: { toDate: () => new Date(`${previousYear}-06-01`) }
          }
        })
      });

      await updateCropData(farmerId, newCrops, newTotalAcres, currentYear);
      expect(mockFirebase.transactionSet).toHaveBeenCalledTimes(2);
      const archiveCall = mockFirebase.transactionSet.mock.calls.find(call => 
        call[1].year === previousYear && call[1].crops === oldCrops
      );
      expect(archiveCall).toBeDefined();
      expect(archiveCall[1]).toMatchObject({
        year: previousYear,
        crops: oldCrops,
        totalAcres: oldTotalAcres
      });
    });

    test('should throw error if farmer profile not found', async () => {
      mockFirebase.transactionGet.mockResolvedValue({ exists: false });
      await expect(updateCropData(farmerId, newCrops, newTotalAcres, currentYear))
            .rejects.toThrow('Farmer profile not found.');
    });
  });

  describe('getCropHistory', () => {
    const farmerId = 'test-farmer-002';
    test('should retrieve crop history for specified years', async () => {
      const mockHistoryDocs = [
        { id: '2024', data: () => ({ year: 2024, crops: [{type: 'flax', acres: 200}], totalAcres: 200 }) },
        { id: '2023', data: () => ({ year: 2023, crops: [{type: 'peas', acres: 150}], totalAcres: 150 }) }
      ];
      mockFirebase.queryGet.mockResolvedValue({ empty: false, docs: mockHistoryDocs });
      const history = await getCropHistory(farmerId, 2);
      expect(mockFirebase.queryGet).toHaveBeenCalledTimes(1);
      expect(history).toHaveLength(2);
      expect(history[0].year).toBe(2024);
    });

    test('should return empty array if no history found', async () => {
      mockFirebase.queryGet.mockResolvedValue({ empty: true, docs: [] });
      const history = await getCropHistory(farmerId, 3);
      expect(history).toEqual([]);
    });

    test('should throw error if farmerId is not provided', async () => {
        await expect(getCropHistory(null, 5)).rejects.toThrow('Farmer ID is required to get crop history.');
    });
  });
});
