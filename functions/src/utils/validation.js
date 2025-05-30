// functions/src/utils/validation.js
const admin = require('firebase-admin');

// Ensure Firebase admin is initialized (important if this module is used independently)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Generates a unique username from a base name
 */
async function generateUniqueUsername(baseName) {
  if (!baseName || typeof baseName !== 'string') {
    baseName = 'farmer'; // Default base if none provided
  }
  const cleanBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters, keep only letters and numbers
    .substring(0, 15); // Limit length
  
  let username = cleanBase || 'user'; // Fallback if cleanBase is empty
  let suffix = 1;
  let isUnique = false;
  const db = admin.firestore();
  
  while (!isUnique) {
    const checkUsername = suffix === 1 && username.length > 0 ? username : `${username}${suffix}`;
    // If username itself is empty after cleaning (e.g. only special chars provided), start with 'user1'
    const finalUsernameToTest = checkUsername.length > 0 ? checkUsername : `user${suffix}`;

    try {
        const exists = await db
            .collection('usernames')
            .doc(finalUsernameToTest)
            .get();
        
        if (!exists.exists) {
            username = finalUsernameToTest;
            isUnique = true;
        } else {
            suffix++;
            if (suffix > 1000) { // Safety break
                console.error('Could not generate unique username after 1000 attempts for base:', cleanBase);
                username = `${cleanBase || 'user'}${Date.now().toString().slice(-6)}`;
                // Final check for the highly randomized one
                const fallbackExists = await db.collection('usernames').doc(username).get();
                if(fallbackExists.exists) throw new Error('Unique username generation definitively failed.');
                isUnique = true; // Assume this is unique enough or accept the very slim chance of collision
            }
        }
    } catch (error) {
        console.error('Firestore error while checking username uniqueness:', error);
        // Fallback to a more random username in case of DB error during check
        username = `${cleanBase || 'user'}${Date.now().toString().slice(-4)}`; 
        isUnique = true; // Proceed with this generated username, logging the error.
    }
  }
  
  return username;
}

/**
 * Validates username format
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username must be a string.' };
  }
  
  const trimmedUsername = username.trim();

  if (trimmedUsername.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (trimmedUsername.length > 20) {
    return { valid: false, error: 'Username must be no more than 20 characters long.' };
  }
  
  // Regex: letters, numbers, and underscores only. Must not be all numbers.
  if (!/^[a-z0-9_]+$/i.test(trimmedUsername)) {
    return { 
        valid: false, 
        error: 'Username can only contain letters, numbers, and underscores.' 
    };
  }
  if (/^[0-9_]+$/.test(trimmedUsername)) { // Check if it's all numbers or underscores
    return { valid: false, error: 'Username cannot be all numbers or underscores.' };
  }
  
  return { valid: true };
}

module.exports = {
  generateUniqueUsername,
  validateUsername
};
