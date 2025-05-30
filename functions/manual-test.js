// functions/manual-test.js

// Require the specific SERVICE function we want to test
const { getWeatherWithInsights } = require('./src/services/weather');
const { initializeApp, firestore } = require('firebase-admin/app'); // For potential Firestore init if not done by services
const admin = require('firebase-admin');

console.log("Starting manual test for getWeatherWithInsights SERVICE function...");

// Parameters for the service function
const testProvince = 'MB';
const testStation = 's0000193'; // Winnipeg The Forks

async function runTest() {
  try {
    // Ensure Firebase Admin is initialized, as services might depend on it.
    // Services like analytics or caching might try to access Firestore.
    if (!admin.apps.length) {
      console.log("Initializing Firebase Admin SDK for the test...");
      admin.initializeApp(); 
      // If you were using specific credentials for a real project:
      // const serviceAccount = require("../path/to/your/serviceAccountKey.json");
      // admin.initializeApp({
      //   credential: admin.credential.cert(serviceAccount)
      // });
    }

    console.log(`
Testing service with: province=${testProvince}, station=${testStation}
`);

    // Invoke the service function directly
    const result = await getWeatherWithInsights(testProvince, testStation);

    console.log('Service Function Response:');
    console.log(JSON.stringify(result, null, 2));

    console.log(`
Manual test of service function completed.
`);

  } catch (e) {
    console.error("Error during manual service test execution:", e);
    if (e.stack) {
        console.error(e.stack);
    }
  } finally {
    // Optional: terminate the app if it hangs due to Firebase connections
    // This might be needed if background tasks keep the script alive.
    // await admin.app().delete(); // This can be aggressive, use if script doesn't exit.
    // For a simple script, process.exit() might be okay if it hangs.
    // For now, let's see if it exits cleanly.
  }
}

runTest();
