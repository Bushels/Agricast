// functions/test-local/quickTest.js
const admin = require('firebase-admin');

// Initialize admin minimally - it might not be needed if the function doesn't use Firebase services
// For findNearestWeatherStation as implemented, admin isn't used.
// if (!admin.apps.length) {
//   admin.initializeApp(); 
// }

const { findNearestWeatherStation } = require('../src/utils/weatherStations');

async function test() {
  console.log("Running quickTest for findNearestWeatherStation...");
  try {
    const station = await findNearestWeatherStation({ lat: 50.0, lng: -100.0 });
    console.log('Nearest station found:', station);
    if (station && station.id) {
        console.log("quickTest PASSED.");
    } else {
        console.error("quickTest FAILED: No station found or station format incorrect.");
    }
  } catch (error) {
    console.error("quickTest FAILED with error:", error);
  }
}

test();
