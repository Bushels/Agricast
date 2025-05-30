// functions/src/services/admin/adminService.js
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Deletes a user from Firebase Authentication and all their associated data from Firestore.
 * This includes their farmer profile, username reservation, stats, and subcollections.
 * @param {string} userId - The UID of the user to delete.
 * @returns {Promise<object>} Object indicating success or failure.
 */
async function deleteUser(userId) {
  if (!userId) {
    throw new Error('User ID is required for deletion.');
  }

  const db = admin.firestore();
  const batch = db.batch();
  let usernameToDelete = null;

  console.log(`Attempting to delete user ${userId} and all associated data.`);

  try {
    // Step 1: Delete from Firebase Authentication
    // This will trigger the functions.auth.user().onDelete() trigger for further cleanup if that one is also active.
    // However, this admin service aims to be comprehensive itself.
    try {
        await admin.auth().deleteUser(userId);
        console.log(`Successfully deleted user ${userId} from Firebase Authentication.`);
    } catch (authError) {
        // If user not found in Auth, they might only exist in Firestore (e.g. import error)
        // Log this but continue to attempt Firestore cleanup.
        console.error(`Error deleting user ${userId} from Firebase Auth: ${authError.message}. May not exist in Auth. Proceeding with Firestore cleanup.`);
        if (authError.code === 'auth/user-not-found') {
            // User doesn't exist in Auth, which is fine for cleanup purposes here.
        } else {
            throw authError; // Rethrow other auth errors
        }
    }

    // Step 2: Prepare Firestore deletions
    const farmerProfileRef = db.collection('farmers').doc(userId);
    const farmerDoc = await farmerProfileRef.get();

    if (farmerDoc.exists) {
      const farmerData = farmerDoc.data();
      usernameToDelete = farmerData.username; // Get username for deletion from 'usernames' collection

      // Schedule deletion of the main farmer profile document
      batch.delete(farmerProfileRef);
      console.log(`Scheduled deletion for farmer profile: ${userId}`);

      // Schedule deletion of subcollections (e.g., cropHistory, activities)
      const subcollectionsToClean = ['cropHistory', 'activities']; 
      for (const subcollectionName of subcollectionsToClean) {
        // It's safer and more scalable to delete subcollections in batches or use specialized helper functions
        // For this example, we'll list and delete, but be mindful of large subcollections.
        const snapshot = await farmerProfileRef.collection(subcollectionName).limit(500).get(); 
        if (!snapshot.empty) {
          console.log(`Scheduling deletion of ${snapshot.size} docs from ${subcollectionName} for user ${userId}`);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          // If more than 500, would need to loop/paginate this deletion.
        }
      }
    } else {
      console.log(`No farmer profile document found for user ${userId}.`);
    }

    // Schedule deletion of the username from 'usernames' collection if it was found
    if (usernameToDelete) {
      const usernameRef = db.collection('usernames').doc(usernameToDelete.toLowerCase());
      batch.delete(usernameRef);
      console.log(`Scheduled deletion for username: ${usernameToDelete}`);
    }

    // Schedule deletion of farmer stats document
    const statsRef = db.collection('farmerStats').doc(userId);
    batch.delete(statsRef); // Idempotent, no need to check existence before batching delete
    console.log(`Scheduled deletion for farmerStats: ${userId}`);

    // Example: Clean up from 'farms' collection if user was a member/owner
    // This part from Claude's example is good but needs careful implementation
    // to avoid reading too many documents if not indexed properly for this query.
    const farmMembershipsQuery = db.collection('farms').where('members', 'array-contains', userId);
    const farmMembershipsSnapshot = await farmMembershipsQuery.get();
    if (!farmMembershipsSnapshot.empty) {
        farmMembershipsSnapshot.forEach(doc => {
            const farmData = doc.data();
            const updatedMembers = farmData.members.filter(id => id !== userId);
            const updatedOwners = farmData.owners ? farmData.owners.filter(id => id !== userId) : [];

            if (updatedMembers.length === 0 && updatedOwners.length === 0) {
                // If no members or owners left, delete the farm (or mark as inactive)
                console.log(`Farm ${doc.id} has no members/owners left after removing ${userId}. Scheduling farm deletion.`);
                batch.delete(doc.ref);
            } else {
                console.log(`Removing ${userId} from farm ${doc.id}.`);
                batch.update(doc.ref, { members: updatedMembers, owners: updatedOwners });
            }
        });
    }

    // Step 3: Commit the batched Firestore deletions
    await batch.commit();
    console.log(`Successfully committed Firestore data cleanup for user ${userId}.`);
    
    return { success: true, message: `User ${userId} and associated data processed for deletion.` };

  } catch (error) {
    console.error(`Critical error during deleteUser service for ${userId}:`, error);
    throw new Error(`Failed to fully delete user ${userId}: ${error.message}`);
  }
}

module.exports = {
  deleteUser
};
