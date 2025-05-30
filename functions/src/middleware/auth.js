// functions/src/middleware/auth.js
const admin = require('firebase-admin');

// Initialize admin if not already done (should be done in index.js ideally, but good practice to have check)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Validates incoming requests and extracts user information
 * Starts as optional to allow gradual migration
 */
async function validateRequest(req) {
  const authHeader = req.headers.authorization;
  
  // Check for API key first (for automated systems)
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    // You'll store API keys in Firestore
    try {
      const keyDoc = await admin.firestore()
        .collection('apiKeys')
        .doc(apiKey)
        .get();
        
      if (keyDoc.exists && keyDoc.data().active) {
        return {
          authenticated: true,
          uid: keyDoc.data().userId,
          type: 'apiKey',
          keyId: apiKey
        };
      }
    } catch (error) {
      console.error('API key validation error:', error);
      // Do not throw, allow fallback to other auth methods or anonymous
    }
  }
  
  // Check for Firebase Auth token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      return {
        authenticated: true,
        uid: decodedToken.uid,
        email: decodedToken.email,
        type: 'firebase'
      };
    } catch (error) {
      console.warn('Token validation error:', error.message); // Warn instead of error for optional auth
      // Don't throw - allow anonymous access for now
    }
  }
  
  // Allow anonymous access during transition
  // Generate a unique-ish ID for anonymous users for potential basic tracking
  const ip = req.ip || 'unknown_ip';
  const userAgent = req.headers['user-agent'] || 'unknown_agent';
  const anonId = `anon_${ip}_${Buffer.from(userAgent).toString('base64url').substring(0,16)}_${Date.now()}`;

  return {
    authenticated: false,
    uid: anonId, // Use the generated anonymous ID
    type: 'anonymous'
  };
}

/**
 * Middleware to enforce authentication (use this when ready)
 */
function requireAuth(handler) {
  return async (req, res, ...args) => { // ensure other args are passed if cors is wrapping it.
    const authResult = await validateRequest(req);
    
    if (!authResult.authenticated) {
      // If cors is already applied, it might have its own way of sending response.
      // This assumes the handler itself, or a cors wrapper, will eventually call res.status().json()
      // For functions.https.onRequest, the handler is (req, res) directly.
      // If this middleware is used *inside* a cors(req, res, async () => { ... }) block, then this is fine.
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid API key or authentication token'
      });
    }
    
    // Add auth info to request for the actual handler to use
    req.auth = authResult;
    return handler(req, res, ...args);
  };
}

module.exports = {
  validateRequest,
  requireAuth
};
