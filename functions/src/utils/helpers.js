// functions/src/utils/helpers.js
const admin = require('firebase-admin'); // May not be strictly needed here if not accessing DB, but good practice for utils

// Ensure Firebase admin is initialized if this module were to use Firebase services directly.
// For these specific helper functions as defined, it's not directly used.
// if (!admin.apps.length) {
//   admin.initializeApp();
// }

/**
 * Check if email is an alpha tester.
 * In a real application, this might check against a Firestore collection or environment config.
 * @param {string} email - The user's email.
 * @returns {Promise<boolean>} True if the user is an alpha tester.
 */sync function isAlphaTester(email) {
  if (!email) return false;
  // Example: Check against a predefined list or a specific domain suffix
  const alphaTesterEmails = [
    'alpha@example.com', // Add specific alpha tester emails
    'test@agricast.com' // As per Claude's example
  ];
  return alphaTesterEmails.includes(email.toLowerCase()) || email.toLowerCase().endsWith('@agricast.alpha');
}

/**
 * Check if email is a beta tester.
 * @param {string} email - The user's email.
 * @returns {Promise<boolean>} True if the user is a beta tester.
 */sync function isBetaTester(email) {
  if (!email) return false;
  // Example: Check against a predefined list or a specific domain suffix
  const betaTesterEmails = [
    'beta@example.com' // Add specific beta tester emails
  ];
  return betaTesterEmails.includes(email.toLowerCase()) || email.toLowerCase().endsWith('@agricast.beta');
}

/**
 * Get growing season information by province (simplified).
 * @param {string} province - Province code (e.g., 'MB', 'SK', 'AB').
 * @returns {object} Object containing season start, end, and frost-free days.
 */
function getGrowingSeasonInfo(province) {
  const normalizedProvince = province?.toUpperCase();
  const seasonInfo = {
    'MB': { start: 'Mid-May', end: 'Early October', frostFree: '120-130 days' },
    'SK': { start: 'Mid-May', end: 'Late September', frostFree: '110-120 days' },
    'AB': { start: 'Early May', end: 'Late September', frostFree: '100-120 days' }
    // Add other provinces if necessary
  };
  return seasonInfo[normalizedProvince] || { start: 'May', end: 'September', frostFree: 'approx. 120 days' }; // Default
}

/**
 * Generate welcome insights for new farmers.
 * @param {object} farmerProfile - The newly created farmer profile.
 * @returns {Promise<object>} An object containing welcome messages and tips.
 */sync function generateWelcomeInsights(farmerProfile) {
  if (!farmerProfile) return { message: 'Welcome to Agricast!', tips: [] };

  const insights = {
    message: `Welcome to Agricast, ${farmerProfile.farmName || farmerProfile.username}!`,
    locationInfo: {
      nearestStation: farmerProfile.location?.derived?.nearestStation?.name || 'Not set',
      climateZone: farmerProfile.location?.derived?.climateRegion || 'Not set',
      soilType: farmerProfile.location?.derived?.soilZone || 'Not set'
    },
    tips: [
      'Explore your personalized weather dashboard daily.',
      'Report local conditions like rainfall or frost to help your community and earn points!',
      'Customize your notification preferences in your profile.'
    ],
    quickStats: {
      farmSizeAcres: farmerProfile.farmDetails?.totalAcres || 0,
      mainCrop: farmerProfile.farmDetails?.crops?.[0]?.type || 'Not specified',
      growingSeason: getGrowingSeasonInfo(farmerProfile.location?.derived?.province)
    }
  };
  
  return insights;
}

module.exports = {
  isAlphaTester,
  isBetaTester,
  generateWelcomeInsights,
  getGrowingSeasonInfo // Exporting for potential direct use elsewhere if needed
};
