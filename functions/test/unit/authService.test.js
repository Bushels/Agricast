// functions/test/unit/authService.test.js
const { registerFarmer } = require('../../src/services/auth/authService');
const admin = require('firebase-admin');

// --- Mock Firebase Admin SDK ---
jest.mock('firebase-admin', () => {
  const mockBatchSet = jest.fn();
  const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
  const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));
  const mockDocGet = jest.fn();
  const mockDocSet = jest.fn();
  const mockDoc = jest.fn(() => ({ get: mockDocGet, set: mockDocSet }));
  const mockCollection = jest.fn(() => ({ doc: mockDoc }));
  const firestoreMockFn = jest.fn(() => ({ collection: mockCollection, batch: mockBatch }));
  firestoreMockFn.FieldValue = { serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP') };
  const mockAuthInstance = { setCustomUserClaims: jest.fn().mockResolvedValue(undefined), getUser: jest.fn().mockResolvedValue({ email: 'mockuser@example.com' }) };
  const authMockFn = jest.fn(() => mockAuthInstance);
  return { apps: [], initializeApp: jest.fn(), firestore: firestoreMockFn, auth: authMockFn };
});
// --- End of Firebase Admin SDK Mock ---

// Mock utility functions
jest.mock('../../src/utils/validation', () => ({
  generateUniqueUsername: jest.fn(async (base) => `${base.toLowerCase().replace(/[^a-z0-9]/g, '')}_mock123`),
}));
jest.mock('../../src/utils/canadianGeography', () => ({
  getDLSCoordinates: jest.fn(async () => ({ lat: 50.01, lng: -100.01 })),
  getDLSFromCoordinates: jest.fn(async () => ({ meridian: 1, township: 1, range: 1, approximate: true })),
  getSoilZone: jest.fn(async () => 'Mock Soil Zone'),
  getClimateRegion: jest.fn(async () => 'Mock Climate Region'),
  reverseGeocode: jest.fn(async () => ({ province: 'MCK', county: 'Mock Rural Municipality', nearestTown: 'Mocktown' }))
}));
jest.mock('../../src/utils/weatherStations', () => ({
  findNearestWeatherStation: jest.fn(async () => ({ id: 's0000mock', name: 'Mock Station', province: 'MCK', distance: 15 }))
}));
jest.mock('../../src/utils/helpers', () => ({
  isAlphaTester: jest.fn().mockResolvedValue(false),
  isBetaTester: jest.fn().mockResolvedValue(false),
  generateWelcomeInsights: jest.fn(async (profile) => ({ message: `Welcome ${profile.username}!`}))
}));

describe('Auth Service - registerFarmer', () => {
  const mockFirestoreDocGet = admin.firestore().collection().doc().get;
  const mockBatchSet = admin.firestore().batch().set;
  const mockBatchCommit = admin.firestore().batch().commit;
  const mockSetCustomUserClaims = admin.auth().setCustomUserClaims;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestoreDocGet.mockReset(); 
    // Reset helper mocks to their default (false) for each test, can be overridden per test.
    const helpers = require('../../src/utils/helpers');
    helpers.isAlphaTester.mockResolvedValue(false);
    helpers.isBetaTester.mockResolvedValue(false);
  });

  test('should create a farmer profile successfully with minimal data', async () => {
    const authUser = { uid: 'test-uid-email-001', email: 'minimal@farm.com', providerData: [{ providerId: 'password' }] };
    const profileData = { farmName: 'Minimal Test Farm', location: { method: 'pin', coordinates: { lat: 52.2, lng: -106.7 } } };
    mockFirestoreDocGet.mockResolvedValueOnce({ exists: false }); 
    const result = await registerFarmer(authUser, profileData);
    expect(result.success).toBe(true);
    expect(mockBatchSet).toHaveBeenCalledTimes(3);
  });

  test('should create a farmer profile with provided username and detailed data', async () => {
    const authUser = { uid: 'test-uid-full-002', email: 'full@farm.com', providerData: [{ providerId: 'google.com' }] };
    const profileData = { username: 'fullfarmer', farmName: 'Full Data Farm', location: {method: 'pin', coordinates: {lat:1,lng:1}} };
    admin.firestore().collection('usernames').doc('fullfarmer').get.mockResolvedValueOnce({ exists: false });
    await registerFarmer(authUser, profileData);
    expect(mockBatchSet).toHaveBeenCalledTimes(3);
  });

  test('should generate username if not provided, using email prefix', async () => {
    const authUser = { uid: 'test-uid-gen-003', email: 'prefixuser@example.com' };
    const profileData = { farmName: '', location: { method: 'pin', coordinates: {lat:1,lng:1}} };
    mockFirestoreDocGet.mockResolvedValueOnce({ exists: false });
    const result = await registerFarmer(authUser, profileData);
    expect(result.username).toBe('prefixuser_mock123');
  });

  test('should throw error if username is already taken', async () => {
    const authUser = { uid: 'test-uid-conflict-004', email: 'conflict@farm.com' };
    const profileData = { username: 'existinguser', farmName: 'Conflict Farm' };
    admin.firestore().collection('usernames').doc('existinguser').get.mockResolvedValueOnce({ exists: true });
    await expect(registerFarmer(authUser, profileData)).rejects.toThrow('Username already taken. Please choose another.');
  });

  test('should assign alpha/beta tester badges and claims if email matches', async () => {
    const helpersMock = require('../../src/utils/helpers');
    
    // --- Alpha User Test Part ---
    const authUserAlpha = { uid: 'alpha-001', email: 'dev@agricast.alpha' };
    const profileDataAlpha = { farmName: 'Alpha Base Farm', location: { method: 'pin', coordinates: {lat:1,lng:1}} };
    helpersMock.isAlphaTester.mockReturnValueOnce(Promise.resolve(true)); // Alpha true, Beta default (false)
    mockFirestoreDocGet.mockResolvedValueOnce({ exists: false }); 
    const resultAlpha = await registerFarmer(authUserAlpha, profileDataAlpha);
    expect(resultAlpha.profile.gamification.badges).toContain('alpha_pioneer');
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith(authUserAlpha.uid, 
      expect.objectContaining({ alphaTester: true, betaTester: false, farmer: true })
    );
    
    // --- Beta User Test Part ---
    // Reset specific helper mocks for the beta scenario
    helpersMock.isAlphaTester.mockReset().mockResolvedValue(false); // Explicitly set alpha to false for beta test
    helpersMock.isBetaTester.mockReset().mockReturnValueOnce(Promise.resolve(true)); // Explicitly set beta to true

    mockFirestoreDocGet.mockReset(); 
    mockFirestoreDocGet.mockResolvedValueOnce({ exists: false }); // Username availability for beta user
    mockSetCustomUserClaims.mockClear(); // Clear calls from alpha part

    const authUserBeta = { uid: 'beta-001', email: 'tester@agricast.beta' };
    const profileDataBeta = { farmName: 'Beta Test Stead', location: { method: 'pin', coordinates: {lat:1,lng:1}} };
    
    const resultBeta = await registerFarmer(authUserBeta, profileDataBeta);

    expect(resultBeta.profile.gamification.badges).toContain('beta_explorer');
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith(authUserBeta.uid, 
      expect.objectContaining({ betaTester: true, alphaTester: false, farmer: true })
    );
  });
});
