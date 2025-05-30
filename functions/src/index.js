// functions/src/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

// Import existing service handlers for weather/NASA (if they are still separate)
const weatherHandlers = require('./handlers/weather'); // Assuming these are still used for v1/legacy
const nasaHandlers = require('./handlers/nasa');     // Assuming these are still used for v1/legacy

// Import services for new functionalities
const { registerFarmer } = require('./services/auth/authService');
const { checkUsername } = require('./services/auth/usernameService'); // Corrected import
const { updateCropData, getCropHistory } = require('./services/crops/cropService'); // Corrected import
const { deleteUser } = require('./services/admin/adminService');       // Corrected import

// ============= V1 HTTP Endpoints (Existing - review if still needed in this structure) =============
// These are kept for now but might be deprecated or refactored if all functionality moves to callable functions.
exports.v1 = {
  weather: functions.https.onRequest(weatherHandlers.handleGetWeather),
  weatherInsights: functions.https.onRequest(weatherHandlers.handleGetWeatherWithInsights),
  precipitation: functions.https.onRequest(nasaHandlers.handleGetNASAPrecipitation),
  multiStation: functions.https.onRequest(nasaHandlers.handleMultipleStations)
};

// ============= Legacy Endpoint Handling (Existing - review) =============
exports.getWeather = exports.v1.weather;
exports.getWeatherWithInsights = exports.v1.weatherInsights;
exports.getNASAPowerData = exports.v1.precipitation; 
exports.getMultipleStations = exports.v1.multiStation;

// ============= USER AUTHENTICATION & PROFILE FUNCTIONS (Callable) =============

exports.createFarmerProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to create a farmer profile.');
  }
  try {
    const authUser = {
      uid: context.auth.uid,
      email: context.auth.token.email || data.email,
      providerData: [{
        providerId: context.auth.token.firebase?.sign_in_provider || 'password'
      }]
    };
    if (!data || (typeof data !== 'object')) {
        throw new functions.https.HttpsError('invalid-argument', 'Profile data is required.');
    }
    if (!data.username && !data.farmName && !authUser.email) {
        throw new functions.https.HttpsError('invalid-argument', 'Username, farm name, or verified email is required.');
    }
    const result = await registerFarmer(authUser, data);
    await admin.firestore().collection('farmers').doc(context.auth.uid).collection('activities').add({
        type: 'account_created',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: { platform: data.platform || 'unknown', appVersion: data.appVersion || 'unknown' }
    });
    return {
        success: true,
        uid: result.uid,
        username: result.username,
        welcomeInsights: result.welcomeInsights
    };
  } catch (error) {
    console.error('Profile creation error in callable function:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to create profile.');
  }
});

exports.checkUsernameAvailability = functions.https.onCall(async (data, context) => {
  const { username } = data;
  if (!username || typeof username !== 'string' || username.length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'Username must be a string and at least 3 characters.');
  }
  try {
    const available = await checkUsername(username); // Now calls the service
    return { available, username: username.toLowerCase() };
  } catch (error) {
    console.error('Error checking username availability:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to check username.');
  }
});

// ============= CROP MANAGEMENT FUNCTIONS (Callable) =============

exports.updateCropData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to update crop data.');
  }
  try {
    const { crops, totalAcres, year } = data;
    if (!Array.isArray(crops) || typeof totalAcres !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid crop data or total acres.');
    }
    const farmerId = context.auth.uid;
    const currentYear = year || new Date().getFullYear();
    await updateCropData(farmerId, crops, totalAcres, currentYear); // Calls the service
    return { success: true, message: 'Crop data updated successfully.', year: currentYear };
  } catch (error) {
    console.error('Crop update error in callable function:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to update crop data.');
  }
});

exports.getCropHistory = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to get crop history.');
  }
  try {
    const farmerIdForLookup = data.farmerId || context.auth.uid;
    const years = data.years;
    if (farmerIdForLookup !== context.auth.uid && !context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied', 'You do not have permission to access this data.');
    }
    const history = await getCropHistory(farmerIdForLookup, years); // Calls the service
    return { history };
  } catch (error) {
    console.error('Get crop history error in callable function:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to get crop history.');
  }
});

// ============= ADMIN FUNCTIONS (Callable) =============

exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users.');
  }
  try {
    const { userId } = data;
    if (!userId) throw new functions.https.HttpsError('invalid-argument', 'User ID is required.');
    await deleteUser(userId); // Calls the service
    await admin.firestore().collection('adminLogs').add({
      action: 'user_deleted', adminId: context.auth.uid, targetUserId: userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: `User ${userId} deleted successfully.` };
  } catch (error) {
    console.error('Admin delete user error in callable function:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to delete user.');
  }
});

exports.setAdminRole = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can set admin roles.');
  }
  try {
    const { userId, isAdmin: makeAdmin } = data;
    if (!userId || typeof makeAdmin !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'User ID and isAdmin boolean are required.');
    }
    await admin.auth().setCustomUserClaims(userId, { admin: makeAdmin, role: makeAdmin ? 'admin' : 'farmer' });
    if (makeAdmin) {
      const userRecord = await admin.auth().getUser(userId); // Get user record for email
      await admin.firestore().collection('admins').doc(userId).set({
        email: userRecord.email || 'N/A',
        addedBy: context.auth.uid,
        addedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      await admin.firestore().collection('admins').doc(userId).delete();
    }
    return { success: true, message: `User ${userId} admin status set to ${makeAdmin}.` };
  } catch (error) {
    console.error('Set admin role error in callable function:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to set admin role.');
  }
});

// ============= SCHEDULED FUNCTIONS =============

exports.seasonalCropPrompt = functions.pubsub
  .schedule('0 8 1 3 *')
  .timeZone('America/Regina')
  .onRun(async (jobContext) => {
    const year = new Date().getFullYear();
    const promptId = `crop_update_${year}`;
    try {
      await admin.firestore().collection('seasonalPrompts').doc(promptId).set({
        year: year, type: 'crop_update',
        title: `Time to Update Your ${year} Crop Plans!`,
        message: 'Spring is approaching! Please take a moment to update your crop rotation and acreage plans for the upcoming season in Agricast.',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        active: true, callToAction: 'Update Crops Now'
      });
      console.log(`Seasonal crop prompt created: ${promptId}`);
      return null;
    } catch(error) {
      console.error('Error creating seasonal crop prompt:', error);
      return null;
    }
  });

// ============= AUTH TRIGGERS =============

exports.cleanupDeletedUser = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  console.log(`Starting cleanup for deleted auth user: ${uid}`);
  const batch = admin.firestore().batch();
  try {
    const farmerProfileRef = admin.firestore().collection('farmers').doc(uid);
    const farmerDoc = await farmerProfileRef.get();
    if (farmerDoc.exists) {
      const farmerData = farmerDoc.data();
      batch.delete(farmerProfileRef);
      if (farmerData.username) {
        const usernameRef = admin.firestore().collection('usernames').doc(farmerData.username.toLowerCase());
        batch.delete(usernameRef);
      }
      const subcollectionsToClean = ['cropHistory', 'activities'];
      for (const subcollectionName of subcollectionsToClean) {
        const snapshot = await farmerProfileRef.collection(subcollectionName).limit(500).get();
        if (!snapshot.empty) snapshot.docs.forEach(doc => batch.delete(doc.ref));
      }
    }
    const statsRef = admin.firestore().collection('farmerStats').doc(uid);
    batch.delete(statsRef);
    await batch.commit();
    console.log(`Successfully cleaned up data for user ${uid}.`);
    return null;
  } catch (error) {
    console.error(`Error cleaning up data for user ${uid}:`, error);
    return null;
  }
});
