// functions/src/config/auth.js
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
// This ensures admin is available for auth operations and other services.
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Auth configuration for multiple providers
 * Supports Email/Password, Google, and Apple Sign-In (as per Claude's design)
 */
const authConfig = {
  providers: {
    email: true,     // Enable Email/Password
    google: true,    // Enable Google Sign-In
    apple: true      // Enable Apple Sign-In (requires Apple Dev setup)
  },
  
  // Custom claims to be set for farmer roles
  customClaims: {
    farmer: true,        // Default claim for all registered farmers
    betaTester: false,   // Example: could be set based on email list
    alphaTester: false   // Example: could be set based on email list
  }
};

module.exports = { admin, authConfig };
