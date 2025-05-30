// functions/src/services/crops/cropService.js
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized (though typically done in index.js)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Updates crop data for a farmer for a given year.
 * Archives the previous year's crop data if it exists and is different.
 * @param {string} farmerId - The UID of the farmer.
 * @param {Array<object>} crops - Array of crop objects for the current year.
 * @param {number} totalAcres - Total farm acreage for the current year.
 * @param {number} year - The year for which to update crop data (e.g., 2024).
 * @returns {Promise<object>} Object indicating success.
 */
async function updateCropData(farmerId, crops, totalAcres, year) {
  const db = admin.firestore();
  const farmerRef = db.collection('farmers').doc(farmerId);
  
  if (!farmerId || !Array.isArray(crops) || typeof totalAcres !== 'number' || !year) {
    throw new Error('Invalid arguments for updateCropData');
  }

  try {
    await db.runTransaction(async (transaction) => {
      const farmerDoc = await transaction.get(farmerRef);
      
      if (!farmerDoc.exists) {
        throw new Error('Farmer profile not found.');
      }
      
      const farmerData = farmerDoc.data();
      const currentUpdateYear = parseInt(year, 10);
      
      // Check existing farmDetails and crops
      const existingFarmDetails = farmerData.farmDetails || {}; // Handle case where farmDetails might not exist
      const existingCrops = existingFarmDetails.crops || [];
      const lastUpdateTimestamp = existingFarmDetails.lastUpdated;
      let lastUpdateYear = null;

      if (lastUpdateTimestamp && lastUpdateTimestamp.toDate) {
        lastUpdateYear = lastUpdateTimestamp.toDate().getFullYear();
      } else if (existingCrops.length > 0 && !lastUpdateTimestamp) {
        // If crops exist but no lastUpdated, assume they are for a prior year or need archiving
        // This logic might need refinement based on how data is initially populated.
        // For safety, assume previous year if not explicitly set.
        lastUpdateYear = currentUpdateYear -1; 
        console.warn(`lastUpdated timestamp not found for farmer ${farmerId}, assuming crops are from previous year for archival.`);
      }

      // Archive current crop data if it's from a different year and there are crops to archive
      if (lastUpdateYear && lastUpdateYear < currentUpdateYear && existingCrops.length > 0) {
        console.log(`Archiving crop data for farmer ${farmerId} from year ${lastUpdateYear} to cropHistory.`);
        const historyRef = farmerRef.collection('cropHistory').doc(lastUpdateYear.toString());
        transaction.set(historyRef, {
          year: lastUpdateYear,
          crops: existingCrops, // Archive existing crops
          totalAcres: existingFarmDetails.totalAcres || 0, // Archive existing totalAcres
          archivedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Update current crop data in farmDetails
      transaction.update(farmerRef, {
        'farmDetails.crops': crops, // New crop data for the specified year
        'farmDetails.totalAcres': totalAcres,
        'farmDetails.lastUpdated': admin.firestore.FieldValue.serverTimestamp(), // Timestamp of this update
        'farmDetails.currentSeasonYear': currentUpdateYear, // Explicitly track the year this data is for
        'metadata.lastActive': admin.firestore.FieldValue.serverTimestamp() // Update last active
      });
      
      // Log the activity in a subcollection
      const activityRef = farmerRef.collection('activities').doc(); // Auto-ID for activity
      transaction.set(activityRef, {
        type: 'crop_data_updated', // More specific type
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: { // Changed 'data' to 'details' for clarity
          yearUpdated: currentUpdateYear,
          cropCount: crops.length,
          newTotalAcres: totalAcres
        }
      });
    });
    
    console.log(`Crop data successfully updated for farmer ${farmerId} for year ${year}.`);
    return { success: true, message: 'Crop data updated successfully.' };
    
  } catch (error) {
    console.error(`Error updating crop data for farmer ${farmerId}:`, error);
    // Re-throw the error so the calling function (e.g., Cloud Function) can handle it
    throw new Error(`Failed to update crop data: ${error.message}`); 
  }
}

/**
 * Get crop history for a farmer, limited by the number of years.
 * @param {string} farmerId - The UID of the farmer.
 * @param {number} [yearsToFetch=5] - Number of past years of history to fetch.
 * @returns {Promise<Array<object>>} An array of crop history objects.
 */
async function getCropHistory(farmerId, yearsToFetch = 5) {
  const db = admin.firestore();
  if (!farmerId) {
    throw new Error('Farmer ID is required to get crop history.');
  }

  const historyQuery = db.collection('farmers').doc(farmerId)
    .collection('cropHistory')
    .orderBy('year', 'desc') // Order by year descending to get recent years first
    .limit(Math.max(1, parseInt(yearsToFetch, 10) || 5)); // Ensure limit is at least 1
  
  try {
    const snapshot = await historyQuery.get();
    const history = [];
    
    if (snapshot.empty) {
      console.log(`No crop history found for farmer ${farmerId}.`);
      return history; // Return empty array
    }

    snapshot.forEach(doc => {
      history.push({
        // year: doc.id, // doc.id is the year string, so it's redundant if 'year' field exists
        ...doc.data() // Spread the document data which should include the 'year' field
      });
    });
    
    console.log(`Fetched ${history.length} year(s) of crop history for farmer ${farmerId}.`);
    return history;
    
  } catch (error) {
    console.error(`Error getting crop history for farmer ${farmerId}:`, error);
    throw new Error(`Failed to get crop history: ${error.message}`);
  }
}

module.exports = {
  updateCropData,
  getCropHistory
};
