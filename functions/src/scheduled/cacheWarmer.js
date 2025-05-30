// functions/src/scheduled/cacheWarmer.js
const functions = require('firebase-functions');
const { fetchECCCWeather } = require('../services/weather'); // fetchECCCWeather is our getWeatherData
const { getPopularStations } = require('../services/analytics');
const admin = require('firebase-admin'); // Required for potential Firestore interactions within services

// Ensure Firebase Admin is initialized (ideally once in index.js or a central config)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Warms cache with rate limiting to avoid overwhelming ECCC
 */
async function warmStationsWithRateLimit(stations, concurrency = 3) {
  const results = [];
  
  // Process in batches
  for (let i = 0; i < stations.length; i += concurrency) {
    const batch = stations.slice(i, i + concurrency);
    
    const batchPromises = batch.map(station => 
      fetchECCCWeather(station.province, station.station) // Using fetchECCCWeather
        .then(() => {
          console.log(`✓ Warmed cache for ${station.name || station.station} (${station.province})`);
          return { status: 'fulfilled', station: `${station.province}/${station.station}` };
        })
        .catch(error => {
          console.error(`✗ Failed to warm ${station.name || station.station} (${station.province}):`, error.message);
          return { status: 'rejected', station: `${station.province}/${station.station}`, error: error.message };
        })
    );
    
    // This should be Promise.allSettled to ensure all complete, even if some fail
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : r.reason)); // Store the actual outcome
    
    // Small delay between batches to be respectful of ECCC's servers
    if (i + concurrency < stations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1-second delay
    }
  }
  
  return results;
}

/**
 * Warms cache for Central time zone (Manitoba/Saskatchewan)
 * Runs at 5 AM local time
 */
exports.warmCacheCentral = functions
  .runWith({ 
    timeoutSeconds: 540, // 9 minutes
    memory: '512MB'
  })
  .pubsub
  .schedule('0 5 * * *') // Correct cron syntax for 5 AM daily
  .timeZone('America/Winnipeg')
  .onRun(async (context) => {
    console.log('Starting cache warming for Central time zone (MB, SK)');
    
    // Get list of popular stations from analytics
    const popularStations = await getPopularStations(10); // Get top 10 popular
    console.log('Popular stations fetched:', popularStations);

    // Also include critical agricultural regions
    const priorityStations = [
      { province: 'MB', station: 's0000193', name: 'Winnipeg' },
      { province: 'MB', station: 's0000492', name: 'Brandon' },
      { province: 'MB', station: 's0000626', name: 'Portage la Prairie' },
      { province: 'SK', station: 's0000788', name: 'Regina' },
      { province: 'SK', station: 's0000797', name: 'Saskatoon' }
    ];
    
    // Combine popular and priority stations, ensuring no duplicates
    const allStationsMap = new Map();
    priorityStations.forEach(s => allStationsMap.set(`${s.province}/${s.station}`, s));
    popularStations.forEach(s => {
      if (!allStationsMap.has(`${s.province}/${s.station}`)) {
        allStationsMap.set(`${s.province}/${s.station}`, s);
      }
    });
    const allStations = Array.from(allStationsMap.values());
    console.log('Total stations to warm (Central):', allStations);

    // Warm cache with controlled concurrency
    const results = await warmStationsWithRateLimit(allStations, 3); // Concurrency of 3
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected' || r.status === 'rejected').length;
    console.log(`Cache warming for Central TZ complete: ${successful} successful, ${failed} failed out of ${allStations.length} stations.`);
    
    if (failed > 0) {
        console.warn('Some stations failed to warm in Central TZ. Details:', results.filter(r => r.status === 'rejected' || r.status === 'rejected'));
    }

    return null;
  });

// Mountain time zone cache warming (Alberta)
exports.warmCacheMountain = functions
  .runWith({ 
    timeoutSeconds: 540, // 9 minutes
    memory: '512MB'
  })
  .pubsub
  .schedule('0 5 * * *') // Correct cron syntax for 5 AM daily
  .timeZone('America/Edmonton')
  .onRun(async (context) => {
    console.log('Starting cache warming for Mountain time zone (AB)');
    
    const popularStationsAB = await getPopularStations(5); // Get top 5 for AB region (example)
     console.log('Popular AB stations fetched:', popularStationsAB);

    const priorityStationsAB = [
      { province: 'AB', station: 's0000047', name: 'Calgary' },
      { province: 'AB', station: 's0000045', name: 'Edmonton' },
      { province: 'AB', station: 's0000030', name: 'Lethbridge' }
      // Add more specific AB stations if needed
    ];

    const allStationsABMap = new Map();
    priorityStationsAB.forEach(s => allStationsABMap.set(`${s.province}/${s.station}`, s));
    popularStationsAB.filter(s => s.province === 'AB').forEach(s => { // Filter popular for AB
        if (!allStationsABMap.has(`${s.province}/${s.station}`)) {
            allStationsABMap.set(`${s.province}/${s.station}`, s);
        }
    });
    const allStationsAB = Array.from(allStationsABMap.values());
    console.log('Total stations to warm (Mountain):', allStationsAB);

    if (allStationsAB.length === 0) {
        console.log('No stations identified for warming in Mountain TZ. Skipping.');
        return null;
    }

    const results = await warmStationsWithRateLimit(allStationsAB, 3); // Concurrency of 3
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected' || r.status === 'rejected').length;
    console.log(`Cache warming for Mountain TZ complete: ${successful} successful, ${failed} failed out of ${allStationsAB.length} stations.`);

    if (failed > 0) {
        console.warn('Some stations failed to warm in Mountain TZ. Details:', results.filter(r => r.status === 'rejected' || r.status === 'rejected'));
    }

    return null;
  });
