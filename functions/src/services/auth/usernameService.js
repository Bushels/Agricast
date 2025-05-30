// functions/src/services/auth/usernameService.js
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Checks if a given username is available (not already taken).
 * @param {string} username - The username to check.
 * @returns {Promise<boolean>} True if the username is available, false otherwise.
 * @throws {Error} If username is invalid or a Firestore error occurs.
 */
async function checkUsername(username) {
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    // This basic validation can also be done in the calling Cloud Function for early exit.
    throw new Error('Username must be a non-empty string and at least 3 characters long.');
  }

  const normalizedUsername = username.toLowerCase().trim();
  
  try {
    const usernameDoc = await admin.firestore()
      .collection('usernames')
      .doc(normalizedUsername)
      .get();
    
    return !usernameDoc.exists;
  } catch (error) {
    console.error(`Error checking username availability for "${normalizedUsername}":`, error);
    throw new Error('Failed to check username availability due to a database error.');
  }
}

module.exports = {
  checkUsername
};
