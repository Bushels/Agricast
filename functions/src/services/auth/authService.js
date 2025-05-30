// functions/src/services/auth/authService.js
const { admin } = require('../../config/auth');

// Import actual utility functions
const { generateUniqueUsername } = require('../../utils/validation');
const {
  getDLSCoordinates,
  getDLSFromCoordinates,
  getSoilZone,
  getClimateRegion,
  reverseGeocode // This is a stub in canadianGeography.js for now
} = require('../../utils/canadianGeography');
const { findNearestWeatherStation } = require('../../utils/weatherStations');
const {
  isAlphaTester,
  isBetaTester,
  generateWelcomeInsights
} = require('../../utils/helpers'); // Import from helpers.js


/**
 * Handles farmer registration from multiple auth providers.
 * Creates a comprehensive farmer profile in Firestore.
 */
async function registerFarmer(authUser, profileDataFromClient) {
  try {
    const db = admin.firestore();
    const batch = db.batch();
    
    let username = profileDataFromClient.username;
    if (!username) {
      const baseForUsername = profileDataFromClient.farmName || (authUser.email ? authUser.email.split('@')[0] : 'farmer');
      username = await generateUniqueUsername(baseForUsername);
    } else {
      username = username.toLowerCase();
      const usernameDoc = await db.collection('usernames').doc(username).get();
      if (usernameDoc.exists) {
        throw new Error('Username already taken. Please choose another.');
      }
    }
    
    const locationData = await processLocationData(profileDataFromClient.location || {});
    
    const badges = ['early_adopter'];
    let isAlpha = false;
    let isBeta = false;

    if (authUser.email) {
        // Use the imported helper functions (which are currently synchronous in helpers.js but kept async here for future flexibility)
        isAlpha = await isAlphaTester(authUser.email);
        isBeta = !isAlpha && (await isBetaTester(authUser.email)); 
    }

    if (isAlpha) badges.push('alpha_pioneer');
    if (isBeta) badges.push('beta_explorer');
    
    const farmerProfile = {
      uid: authUser.uid,
      email: authUser.email || null,
      username: username,
      farmName: profileDataFromClient.farmName || '',
      displayFarmName: profileDataFromClient.displayFarmName || false,
      location: locationData,
      farmDetails: {
        totalAcres: parseFloat(profileDataFromClient.totalAcres) || 0,
        ownedAcres: parseFloat(profileDataFromClient.ownedAcres) || 0,
        rentedAcres: parseFloat(profileDataFromClient.rentedAcres) || 0,
        crops: processCropData(profileDataFromClient.crops || []),
        hasLivestock: profileDataFromClient.hasLivestock || false,
        hasIrrigation: profileDataFromClient.hasIrrigation || false,
        usesPrecisionAg: profileDataFromClient.usesPrecisionAg || false
      },
      gamification: {
        points: 100,
        level: 1,
        title: 'Seedling Farmer',
        streak: { current: 0, longest: 0, lastContribution: null },
        badges: badges,
        hiddenBadges: [],
        contributions: { weatherReports: 0, rainfallMeasurements: 0, frostReports: 0, fieldConditions: 0, helpfulVotes: 0 },
        achievementProgress: { earlyRiser: 0, rainGaugeHero: 0, frostSentinel: 0, communityHelper: 0 }
      },
      preferences: {
        units: profileDataFromClient.preferences?.units || 'metric',
        notifications: {
          weatherAlerts: profileDataFromClient.preferences?.notifications?.weatherAlerts !== undefined ? profileDataFromClient.preferences.notifications.weatherAlerts : true,
          communityUpdates: profileDataFromClient.preferences?.notifications?.communityUpdates !== undefined ? profileDataFromClient.preferences.notifications.communityUpdates : true,
          gamificationAlerts: profileDataFromClient.preferences?.notifications?.gamificationAlerts !== undefined ? profileDataFromClient.preferences.notifications.gamificationAlerts : true,
          severeWeather: profileDataFromClient.preferences?.notifications?.severeWeather !== undefined ? profileDataFromClient.preferences.notifications.severeWeather : true,
        },
        privacy: {
          showUsername: profileDataFromClient.preferences?.privacy?.showUsername !== undefined ? profileDataFromClient.preferences.privacy.showUsername : true,
          showLocation: profileDataFromClient.preferences?.privacy?.showLocation || 'county',
          shareDataAnonymously: profileDataFromClient.preferences?.privacy?.shareDataAnonymously !== undefined ? profileDataFromClient.preferences.privacy.shareDataAnonymously : true,
        }
      },
      metadata: {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp(),
        appVersion: profileDataFromClient.appVersion || '1.0.0',
        platform: profileDataFromClient.platform || 'unknown',
        referralSource: profileDataFromClient.referralSource || 'direct',
        authProvider: authUser.providerData?.[0]?.providerId || (authUser.email ? 'password' : 'unknown'),
        isAlphaTester: isAlpha,
        isBetaTester: isBeta
      }
    };
    
    batch.set(db.collection('farmers').doc(authUser.uid), farmerProfile);
    batch.set(db.collection('usernames').doc(username), { uid: authUser.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    batch.set(db.collection('farmerStats').doc(authUser.uid), {
      quickStats: { totalGDD: 0, totalPrecipitation: 0, lastFrost: null, firstFrost: null },
      seasonYear: new Date().getFullYear(),
      uid: authUser.uid
    });
    
    await batch.commit();
    
    await admin.auth().setCustomUserClaims(authUser.uid, {
      farmer: true,
      alphaTester: isAlpha,
      betaTester: isBeta,
      username: username
    });
    
    const welcomeData = await generateWelcomeInsights(farmerProfile);
    
    console.log(`Farmer profile created successfully for UID: ${authUser.uid}, Username: ${username}`);
    return {
      success: true,
      uid: authUser.uid,
      username: username,
      profile: farmerProfile,
      welcomeInsights: welcomeData
    };
    
  } catch (error) {
    console.error('Error in registerFarmer service:', error);
    throw new Error(`Farmer registration failed: ${error.message}`);
  }
}

async function processLocationData(locationInputFromClient) {
  let coordinates = locationInputFromClient.coordinates || { lat: null, lng: null };
  const locationOutput = {
    method: locationInputFromClient.method || (locationInputFromClient.dls?.meridian ? 'dls' : 'pin'),
    dls: locationInputFromClient.dls || {},
    coordinates: coordinates,
    derived: {}
  };

  if (locationOutput.method === 'dls' && locationInputFromClient.dls?.meridian) {
    coordinates = await getDLSCoordinates(locationInputFromClient.dls);
    locationOutput.coordinates = coordinates;
  } else if (coordinates.lat && coordinates.lng) {
    locationOutput.dls = await getDLSFromCoordinates(coordinates);
  }
  
  if (coordinates.lat && coordinates.lng) {
    const [nearestStationData, geoDataFromReverseGeocode, soil, climate] = await Promise.all([
      findNearestWeatherStation(coordinates),
      reverseGeocode(coordinates), // This is still a stub in canadianGeography.js
      getSoilZone(coordinates),
      getClimateRegion(coordinates)
    ]).catch(err => {
        console.error("Error deriving location details:", err);
        return [null, { province: '', county: '', nearestTown: '' }, null, null]; // Ensure defaults match structure
    });

    locationOutput.derived = {
      province: geoDataFromReverseGeocode.province || '',
      county: geoDataFromReverseGeocode.county || '',
      nearestTown: geoDataFromReverseGeocode.nearestTown || '',
      soilZone: soil || '',
      climateRegion: climate || '',
      nearestStation: nearestStationData || { id: '', name: '', distance: 0 }
    };
  } else {
     locationOutput.derived = { province: '', county: '', nearestTown: '', soilZone: '', climateRegion: '', nearestStation: {id:'', name:'', distance: 0}};
     console.warn("Coordinates are missing, derived location data will be empty or placeholder.");
  }
  
  return locationOutput;
}

function processCropData(cropsInputArray) {
  const validCropTypes = [
    'wheat', 'canola', 'barley', 'corn', 'soybeans', 
    'oats', 'flax', 'lentils', 'peas', 'chickpeas',
    'potatoes', 'sugar_beets', 'sunflowers', 'hemp', 'mustard', 'rye', 'triticale', 'other'
  ];
  
  if (!Array.isArray(cropsInputArray)) return [];

  return cropsInputArray.map(crop => {
    const cropType = (crop.type || '').toLowerCase();
    return {
      type: validCropTypes.includes(cropType) ? cropType : (cropType ? 'other' : 'unknown'),
      variety: crop.variety || '',
      acres: parseFloat(crop.acres) || 0,
      fields: Array.isArray(crop.fields) ? crop.fields : [],
      plantingDate: crop.plantingDate || null,
      expectedHarvest: crop.expectedHarvest || null
    };
  }).filter(crop => crop.acres > 0 && crop.type !== 'unknown');
}

module.exports = { registerFarmer };
