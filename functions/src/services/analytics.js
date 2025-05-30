// functions/src/services/analytics.js
const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized (ideally once in index.js or a central config)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Logs API usage for analytics and rate limiting
 */
async function logUsage(userId, endpoint, parameters) {
  try {
    const usageData = {
      userId,
      endpoint,
      parameters,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0], // For daily aggregation
      hour: new Date().getHours() // For hourly patterns
    };
    
    // Store in Firestore for real-time analysis
    await admin.firestore()
      .collection('usage')
      .add(usageData);
    
    // Update user's usage counters for rate limiting (potential future use)
    // This part might need more specific logic based on how userId is structured for anon users
    const userRef = admin.firestore().collection('users').doc(userId); // Assumes userId is a valid doc ID
    await userRef.set({
      lastAccess: admin.firestore.FieldValue.serverTimestamp(),
      // Example of daily usage count. You might want to structure this differently.
      // E.g., dailyUsage: { [endpoint]: admin.firestore.FieldValue.increment(1) }
      // Or dailyUsageByEndpoint: { [endpoint]: { [YYYY-MM-DD]: admin.firestore.FieldValue.increment(1) } }
      [`dailyUsage.${endpoint}`]: admin.firestore.FieldValue.increment(1) 
    }, { merge: true });
    
    console.log(`Usage logged for user ${userId}, endpoint ${endpoint}`);

  } catch (error) {
    // Don't let analytics errors break the main flow
    console.error('Analytics error logging usage:', error);
  }
}

/**
 * Gets popular stations for cache warming
 */
async function getPopularStations(limit = 20) {
  try {
    // Query usage data from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const usageSnapshot = await admin.firestore()
      .collection('usage')
      .where('endpoint', 'in', ['weather_basic', 'weather_insights']) // Ensure these match actual endpoint names used in logUsage
      .where('timestamp', '>=', sevenDaysAgo)
      .get();
    
    // Aggregate by station
    const stationCounts = {};
    usageSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.parameters && data.parameters.province && data.parameters.station) {
        const key = `${data.parameters.province}/${data.parameters.station}`;
        stationCounts[key] = (stationCounts[key] || 0) + 1;
      } else {
        // Log if parameters are not as expected, to help debug
        console.warn('Found usage log with missing station/province params:', data);
      }
    });
    
    // Sort and return top stations
    return Object.entries(stationCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .slice(0, limit)
      .map(([stationKey, count]) => {
        const [province, stationId] = stationKey.split('/');
        return { province, station: stationId, requestCount: count };
      });
      
  } catch (error) {
    console.error('Error getting popular stations:', error);
    return []; // Return empty array on error
  }
}

module.exports = {
  logUsage,
  getPopularStations
};
