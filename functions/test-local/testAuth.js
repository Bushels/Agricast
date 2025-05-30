// functions/test-local/testAuth.js
// This script is for direct local testing of the registerFarmer service.
// Run with: node functions/test-local/testAuth.js

const admin = require('firebase-admin');
const { registerFarmer } = require('../src/services/auth/authService');

// Initialize Firebase Admin SDK
// If emulators are running and configured (e.g., via `firebase emulators:start`),
// this should connect to the emulated services using a demo project ID.
if (!admin.apps.length) {
  console.log('Initializing Firebase Admin for test...');
  admin.initializeApp({
    projectId: 'demo-agricast', // Using the same demo project ID
    // For emulated Firestore, it typically picks up FIRESTORE_EMULATOR_HOST automatically
  });
}

const db = admin.firestore(); // Get Firestore instance after initialization

async function testRegistration() {
  console.log('Starting testFarmerRegistration...');
  
  const testSuffix = Date.now().toString().slice(-5); // Shorter suffix for username
  const testAuthUser = {
    uid: `testUser_${testSuffix}`,
    email: `testfarmer_${testSuffix}@example.com`,
    providerData: [{ providerId: 'password' }]
  };
  
  const testProfileData = {
    username: `tfarmer${testSuffix}`,
    farmName: 'Test Farm Deluxe',
    displayFarmName: true,
    location: {
      method: 'pin',
      coordinates: { lat: 50.123, lng: -100.456 }
    },
    totalAcres: 1200,
    crops: [
      { type: 'wheat', variety: 'Red Fife', acres: 600 },
      { type: 'canola', variety: 'Liberty Link', acres: 600 }
    ],
    platform: 'test-script',
    appVersion: '0.0.1',
    referralSource: 'test-case'
  };

  console.log(`Attempting to register user: ${testAuthUser.uid} with username: ${testProfileData.username}`);

  try {
    const result = await registerFarmer(testAuthUser, testProfileData);
    console.log('Registration successful:', JSON.stringify(result, null, 2));
    
    // Verify data was created
    const farmerDoc = await db.collection('farmers').doc(testAuthUser.uid).get();
    const usernameDoc = await db.collection('usernames').doc(result.username).get();
    const statsDoc = await db.collection('farmerStats').doc(testAuthUser.uid).get();

    if (!farmerDoc.exists) console.error('TEST ASSERTION FAILED: Farmer document not found!');
    else console.log('Farmer document found in Firestore.');

    if (!usernameDoc.exists) console.error('TEST ASSERTION FAILED: Username document not found!');
    else console.log('Username document found in Firestore.');

    if (!statsDoc.exists) console.error('TEST ASSERTION FAILED: FarmerStats document not found!');
    else console.log('FarmerStats document found in Firestore.');

    // Clean up test data
    console.log('Cleaning up test data...');
    const batch = db.batch();
    batch.delete(db.collection('farmers').doc(testAuthUser.uid));
    batch.delete(db.collection('usernames').doc(result.username));
    batch.delete(db.collection('farmerStats').doc(testAuthUser.uid));
    await batch.commit();
    
    console.log('Test data cleanup complete.');
    console.log('testFarmerRegistration PASSED.');

  } catch (error) {
    console.error('testFarmerRegistration FAILED:', error);
    if (error.stack) console.error(error.stack);
  } finally {
    // Optional: Close admin app if script hangs. For testing, often not needed if emulators handle connections.
    // await admin.app().delete(); 
    // process.exit(); // Force exit if it hangs. Best to let it exit naturally if possible.
  }
}

// Run the test
testRegistration().catch(e => console.error("Unhandled error in test script", e));
