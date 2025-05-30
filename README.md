# Agricast - Agricultural Weather Intelligence Platform

## Project Overview

Agricast is a comprehensive agricultural weather intelligence platform designed to provide Canadian farmers with real-time weather data, calculated agricultural metrics, and actionable insights for farming operations. The platform integrates multiple data sources including Environment and Climate Change Canada (ECCC) weather stations and NASA POWER satellite data, while building a community-driven ecosystem where farmers contribute local observations and earn rewards through gamification.

## Vision

To create a farmer-first platform that combines hyperlocal weather intelligence with community insights, helping Canadian farmers make data-driven decisions while building the most accurate agricultural weather network through crowdsourced observations.

## Key Features

### Core Weather Intelligence
- **Real-time Weather Data**: Integration with Environment Canada weather stations
- **7-Day Forecasts**: Detailed hourly breakdowns with precipitation amounts
- **Satellite Data**: NASA POWER integration for historical precipitation analysis
- **Agricultural Calculations**: 
  - Growing Degree Days (GDD) with crop-specific base temperatures
  - Corn Heat Units (CHU)
  - Spray condition assessments (wind, temperature, humidity)
  - Drying conditions scoring
  - Frost risk analysis
  - Evapotranspiration calculations (planned)
  - Disease pressure indices (planned)

### Farmer Engagement & Community
- **User Authentication**: Support for Apple ID, Google, and email/password login
- **Farmer Profiles**: Customizable profiles with farm name and location
- **Canadian-Specific Features**: 
  - Dominion Land Survey (DLS) location input for Western Canada
  - Support for all major Canadian crops including specialized varieties
- **Gamification System**:
  - Points for weather reports, rainfall measurements, and community contributions
  - Achievement badges and farmer levels
  - Daily contribution streaks
  - Community leaderboards
  - Future rewards from agricultural partners

### Data Management
- **Crop Tracking**: Annual crop rotation management with historical archiving
- **Multi-User Farms**: Support for multiple users per farm operation (structure in place)
- **Smart Caching**: Optimized data fetching with appropriate TTLs
- **Offline Support**: Progressive Web App capabilities (planned)

## Current Implementation Status

### ✅ Completed Features

#### Backend Infrastructure
1. **Weather Data Integration**
   - ECCC weather station integration with 5-minute caching
   - NASA POWER satellite data with 24-hour caching
   - Support for multiple weather stations
   - Precipitation amount extraction and detailed forecast insights (PoP, type, amounts, confidence, dry windows, fieldwork recommendations)

2. **Agricultural Calculations Service**
   - Complete GDD and CHU calculations
   - Spray condition assessment algorithm
   - Drying conditions scoring system
   - Frost risk analysis
   - Weather data enrichment with agricultural insights

3. **Authentication & User Management**
   - Firebase Authentication with Cloud Functions for profile creation (supporting multiple providers conceptually)
   - Custom username-based login system (uniqueness checked server-side)
   - Comprehensive farmer profile structure (including DLS, farm details, gamification, preferences)
   - Profile creation flow logic in `authService.js`
   - Admin capabilities for user deletion and role management (via callable Cloud Functions)

4. **Data Architecture**
   - Firestore database design with security rules for farmers, usernames, cropHistory, activities, admin roles, etc.
   - Username uniqueness enforcement mechanism (`usernames` collection)
   - Crop history archiving system (`cropService.js`)
   - Activity logging framework (e.g., 'account_created', 'crop_data_updated')
   - Seasonal prompt system (scheduled function for crop updates)

5. **Cloud Functions**
   - `createFarmerProfile` (callable): User registration and profile creation.
   - `checkUsernameAvailability` (callable): Validates username uniqueness.
   - `updateCropData` (callable): Updates current season crops with archiving.
   - `getCropHistory` (callable): Retrieves historical crop data.
   - `adminDeleteUser` (callable): Admin function to remove a user and their data.
   - `setAdminRole` (callable): Admin function to grant/revoke admin privileges.
   - `seasonalCropPrompt` (scheduled): Creates prompts for farmers (e.g., update crop plans).
   - `cleanupDeletedUser` (auth trigger): Cleans up Firestore data upon Firebase Auth user deletion.
   - Legacy REST endpoints for weather and NASA data (v1 and aliased).

6. **Security & Permissions**
   - Role-based access control (farmer, admin via custom claims) in callable functions and Firestore rules.
   - Row-level security in Firestore rules.
   - API authentication middleware (for v1 REST endpoints).

7. **Testing (Unit & Local)**
   - **Unit Tests (Jest)**: 
       - `authService.test.js`: All tests PASSING (user registration, profile logic, username conflicts, alpha/beta tester logic).
       - `cropService.test.js`: All tests PASSING (crop updates, history retrieval, archiving logic).
   - **Local Node.js Scripts**: 
       - `quickTest.js` (for `findNearestWeatherStation`): PASSED.
       - `testRegistrationFlow.js` (for utilities like DLS conversion, username validation): Runs and shows core utilities are functional. (Note: its internal username uniqueness test had mock scope limitations).
       - `manual-test.js` (for `getWeatherWithInsights` service): Successfully executed, verifying weather/precipitation service logic.

#### Frontend Design
1. **UI/UX Prototype & Design Guide**: Detailed design principles, color palette, component mockups (registration, dashboard, gamification), and UX flow defined by Claude.

### 🚧 In Progress

1. **Frontend Implementation**: Actual coding of React Native / React components and integration with backend.
2. **Enhanced Calculations**: Further agricultural metric development (ET, disease pressure).
3. **Full Integration Testing**: Blocked by Firebase emulator issues in the current cloud IDE environment.

### 📋 Planned Features

(This section remains largely the same as your provided input, reflecting future goals.)

#### Short Term (Next Sprint)
1. **Dashboard Development**
2. **Gamification Implementation**
3. **Community Features**

#### Medium Term
1. **Advanced Analytics**
2. **Push Notifications**
3. **Partner Integrations**

#### Long Term
1. **Precision Agriculture**
2. **Machine Learning**
3. **Expansion**

## Tech Stack

(This section remains the same.)

## Project Structure

(This section remains the same, accurately reflecting the current file organization.)

## Testing - Status, Challenges & Lessons Learned

### Current Status
- **Unit Tests (Jest)**: 
    - `authService.js`: All PASSING. Verifies user registration, profile creation, username conflict handling, and alpha/beta tester logic using mocks.
    - `cropService.js`: All PASSING. Verifies crop data updates, archival of previous year's data, and crop history retrieval using mocks.
- **Utility Function Tests (Node.js)**:
    - `quickTest.js` (for `findNearestWeatherStation` utility): PASSED.
    - `testRegistrationFlow.js` (for DLS conversion, username validation utilities): Runs successfully, demonstrating core utility functionality. *Note: Its test for `generateUniqueUsername` uniqueness had limitations due to mock scope when run as a plain Node script.*
- **Service-Level Manual Test (Node.js)**:
    - `manual-test.js` (for `getWeatherWithInsights` service): Successfully executed, verifying core weather and precipitation data processing logic.

### Challenges & Blockers
- **Firebase Emulator Port Conflicts**: We are consistently unable to start the Firebase Emulators (Auth, Firestore, Functions, Hub, UI) in the current cloud development environment. Errors indicate "port taken" or "port not open," even when trying alternative port configurations. This is the primary blocker for:
    - Full **Integration Tests** (e.g., `functions/test/integration/stage1.test.js` which relies on HTTP calls to emulated functions).
    - **Local test scripts requiring live emulators** (e.g., `functions/test-local/testAuth.js` which needs live Firestore/Auth for end-to-end service testing).
- This issue is presumed to be an environmental constraint of the cloud IDE related to network port allocation or containerization rather than a code issue within the project itself.

### Lessons Learned (Jest Mocking `firebase-admin`)
- **`FieldValue.serverTimestamp`**: When mocking `admin.firestore`, ensure the mock function also has `FieldValue` as a static property: `const firestoreMock = jest.fn(() => instance); firestoreMock.FieldValue = { serverTimestamp: jest.fn() };`.
- **Transaction Methods (`transaction.get`, `.update`, `.set`)**: For testing services that use Firestore transactions (`db.runTransaction(async (transaction) => { ... })`):
    1. Define your `jest.fn()` mocks for `get`, `update`, `set` in a scope accessible to both the `jest.mock` factory and your tests (e.g., at the top of your test file).
    2. Inside the `jest.mock('firebase-admin', ...)` factory, create a `mockTransactionInstance` object: `{ get: yourGetMock, update: yourUpdateMock, set: yourSetMock }`.
    3. Ensure your mock for `admin.firestore().runTransaction` is an async function that calls its callback argument with this `mockTransactionInstance`: `runTransaction: jest.fn(async (callback) => callback(mockTransactionInstance))`.
    4. In your tests, you can then configure (`mockResolvedValue`, etc.) and assert (`toHaveBeenCalledTimes`, etc.) directly on `yourGetMock`, `yourUpdateMock`, `yourSetMock`.
- **Specific Document Path Mocks**: When a test depends on a specific document existing or not (e.g., `db.collection('usernames').doc('someuser').get()`), ensure your `get` mock is configured for that specific call, often using `mockFn.mockResolvedValueOnce({...})` within the test setup if the mock is generic, or by setting up chained mocks like `admin.firestore().collection('usernames').doc('someuser').get.mockResolvedValueOnce({...})` if your main `admin.firestore().collection().doc()` returns a mock that has its own `get` as a `jest.fn()`.
- **`jest.clearAllMocks()` vs. Specific Mock Resets**: `jest.clearAllMocks()` resets all mocks to their basic `jest.fn()` state. If a mock needs to retain a default implementation (e.g., `mockResolvedValue(false)`) across tests but be overridden for specific tests with `.mockResolvedValueOnce()`, re-establish the default in `beforeEach` after `clearAllMocks` or be very specific with one-time mock implementations.
- **Node.js Scripts vs. Jest Runner**: Scripts intended to be run directly with `node some-test-script.js` cannot use Jest's global objects like `jest.fn()`. Any mocking in such scripts must be done with plain JavaScript techniques (e.g., reassigning functions, simple object mocks).

## Next Steps

### Immediate Testing Focus
1.  **Attempt Minimal Emulator Startup**: Try `firebase emulators:start --only functions,firestore,auth --project demo-agricast` (using the `firebase.json` with the `predeploy` hook commented out). This might reduce port conflicts and allow focused emulator-dependent testing if successful.
2.  **If Emulators Remain Blocked**:
    *   Prioritize creating the `test-agricast-auth.html` page as outlined by Claude. This will allow manual end-to-end testing of the authentication and profile creation flow by deploying to a live (test) Firebase project.
    *   Continue with unit/logic testing for any new backend services developed.

### Development
1.  **Gamification Backend**: Begin design and implementation of the backend logic for gamification features (point calculation, badge awarding, streak tracking).
2.  **Frontend Prototyping**: If resources allow, start basic frontend components for registration and dashboard based on Claude's UI/UX guide, focusing on API integration points.
3.  **Review `generateUniqueUsername` Mocking**: Address the minor mock scope issue in `testRegistrationFlow.js` if it impacts further local utility testing, possibly by refactoring `generateUniqueUsername` to allow Firestore instance injection for easier testing or using module-level mocks for that script.

### Longer Term
- Implement a comprehensive **Test Strategy Document** as recommended, outlining approaches for different environments (mock, emulators, live test project) and conditions.
- Explore environment-aware testing scripts/configurations.

(Sections for Getting Started, API Documentation, Contributing, License, Contact remain the same as your provided input.)

---

*Last updated: May 29, 2025*
*Version: 0.5.1 (Backend Core Services Unit Tested)*
