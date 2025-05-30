// functions/test-local/testRegistrationFlow.js
const admin = require('firebase-admin'); 
const { generateUniqueUsername, validateUsername } = require('../src/utils/validation');
const { getDLSCoordinates } = require('../src/utils/canadianGeography');
const { findNearestWeatherStation } = require('../src/utils/weatherStations');

// Initialize admin if validation.js (specifically generateUniqueUsername) doesn't do it.
// validation.js *does* initialize admin if not already present.
if (!admin.apps.length) {
    // This block might not be strictly necessary if validation.js handles init.
    // console.log("Initializing admin for testRegistrationFlow.js (should be done by validation.js ideally)");
    // admin.initializeApp(); 
}

// --- Simple Mock for Firestore used by generateUniqueUsername ---
let mockUsernameDbStore = {}; // In-memory store for our mock

// Store original firestore if it exists (it will after validation.js initializes admin)
const originalFirestore = admin.firestore;

admin.firestore = () => { // This function will be called when admin.firestore() is accessed
    return {
        collection: (collectionName) => {
            // console.log(`Mock Firestore: Accessing collection ${collectionName}`);
            return {
                doc: (docId) => {
                    // console.log(`Mock Firestore: Accessing doc ${docId} in ${collectionName}`);
                    return {
                        get: async () => {
                            // console.log(`Mock Firestore: Getting doc ${docId} from ${collectionName}`);
                            if (collectionName === 'usernames') {
                                return { exists: !!mockUsernameDbStore[docId] };
                            }
                            return { exists: false }; // Default for other collections if any
                        }
                    };
                }
            };
        }
        // Add other Firestore methods here if needed by tested functions directly
    };
};
// --- End of Simple Mock ---

async function testRegistrationFlow() {
  console.log(`=== Testing Core Registration Flow Components ===
`);
  mockUsernameDbStore = {}; // Reset mock DB for each run

  console.log('1. Testing Username Generation & Validation:');
  try {
    const farmNameForUser = "Smith's Family Farm";
    const baseName = farmNameForUser.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
    console.log(`   Input farm name: "${farmNameForUser}", Base for username: "${baseName}"`);

    const generatedUser = await generateUniqueUsername(baseName);
    console.log(`   ✓ Generated username: "${generatedUser}"`);
    mockUsernameDbStore[generatedUser] = { uid: 'temp'}; // Simulate it's taken for next test

    const validation1 = validateUsername(generatedUser);
    console.log(`   Validation for "${generatedUser}": ${validation1.valid ? '✓ Valid' : '✗ Invalid - ' + validation1.error}`);

    const generatedUser2 = await generateUniqueUsername(baseName); // Should generate a suffixed one
    console.log(`   ✓ Generated username (after first is taken): "${generatedUser2}"`);
    const validation2 = validateUsername(generatedUser2);
    console.log(`   Validation for "${generatedUser2}": ${validation2.valid ? '✓ Valid' : '✗ Invalid - ' + validation2.error}`);

    console.log(`
   Testing specific validation cases:`);
    const usernamesToTest = [
        {u: "john123", exp: true},
        {u: "farm_2024", exp: true},
        {u: "ab", exp: false, err: 'Username must be at least 3 characters long.'},
        {u: "user@name", exp: false, err: 'Username can only contain letters, numbers, and single underscores (not at the start or end).' },
        {u: "_invalidstart", exp: false, err: 'Username must start with a letter'},
        {u: "invalidend_", exp: false, err: 'Username can only contain letters, numbers, and single underscores (not at the start or end).' },
        {u: "user__name", exp: false, err: 'Username can only contain letters, numbers, and single underscores (not at the start or end).' },
        {u: "12345", exp: false, err: 'Username cannot be all numbers or underscores.' },
        {u: "valid_user", exp: true}
    ];
    usernamesToTest.forEach(test => {
        const res = validateUsername(test.u);
        const expectedErrorMessage = test.err || '';
        console.log(`   "${test.u}": ${res.valid === test.exp ? '✓' : '✗'} ${res.valid ? 'Valid' : 'Invalid - ' + res.error} (Expected: ${test.exp ? 'Valid' : 'Invalid - (' + expectedErrorMessage + ')'})`);
    });

  } catch (error) {
    console.error('   ✗ Error in Username Generation/Validation:', error.message);
    if(error.stack) console.error(error.stack);
  }

  console.log(`
2. Testing Location Processing:`);
  console.log('   a) DLS Conversion:');
  try {
    const dls = { meridian: 3, township: 52, range: 26, section: 16, quarterSection: 'SW' };
    const coords = await getDLSCoordinates(dls);
    console.log(`      Input: SW-16-52-26-W3`);
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && coords.lat !== null && coords.lng !== null) {
        console.log(`      ✓ Output: ${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°W`);
    } else {
        console.error('      ✗ DLS Conversion did not return valid coordinates.', coords);
    }
  } catch (error) {
    console.error('      ✗ Error in DLS Conversion:', error.message);
  }

  console.log(`
   b) Weather Station Lookup:`);
  try {
    const testCoords = { lat: 50.4452, lng: -104.6189 }; // Regina
    const station = await findNearestWeatherStation(testCoords);
    console.log(`      Input Coords: Regina, SK (${testCoords.lat}, ${testCoords.lng})`);
    if (station && station.name) {
        console.log(`      ✓ Nearest Station: ${station.name} (${station.id}) at ${station.distance}km`);
    } else {
        console.error('      ✗ Weather station lookup did not return a valid station.', station);
    }
  } catch (error) {
    console.error('      ✗ Error in Weather Station Lookup:', error.message);
  }

  console.log(`
3. Testing Crop Data Structure (Conceptual Example):`);
  const mockCrops = [
    { type: 'wheat', variety: 'AAC Brandon', acres: 500 },
    { type: 'canola', acres: 300 },
    { type: 'barley', variety: 'CDC Copeland', acres: 200 }
  ];
  const totalAcres = 1000;
  const allocatedAcres = mockCrops.reduce((sum, crop) => sum + (parseFloat(crop.acres) || 0), 0);
  
  console.log(`   Total Farm Acres: ${totalAcres}`);
  console.log(`   Allocated Acres from mockCrops: ${allocatedAcres}`);
  console.log(`   Crops defined:`);
  mockCrops.forEach(crop => {
    console.log(`     - ${crop.type}: ${crop.acres} acres ${crop.variety ? `(${crop.variety})` : ''}`);
  });
  console.log(`   ✓ Allocation matches total: ${allocatedAcres === totalAcres ? 'Yes' : 'No'}`);

  console.log(`
=== Registration Flow Components Test Complete ===`);
}

async function main() {
    try {
        await testRegistrationFlow();
    } catch (e) {
        console.error("Unhandled error in testRegistrationFlow script:", e);
        if(e.stack) console.error(e.stack);
    }
    // Restore original firestore if it was mocked and admin was initialized by this script
    // However, generateUniqueUsername initializes admin if not present, so this might not be strictly necessary
    // or could conflict if admin was already initialized elsewhere.
    // if (originalFirestore) admin.firestore = originalFirestore;
}

main();
