const axios = require('axios');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Fetch precipitation data from NASA POWER API
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude  
 * @param {string} startDate - Start date (YYYYMMDD format)
 * @param {string} endDate - End date (YYYYMMDD format)
 * @returns {Object} Processed NASA POWER data
 */
async function fetchNASAPowerData(lat, lon, startDate, endDate) {
  // Check cache first
  const cacheKey = `nasa_${lat}_${lon}_${startDate}_${endDate}`;
  const cachedData = await getCachedData(cacheKey);
  if (cachedData) {
    console.log('Returning cached NASA POWER data');
    return cachedData;
  }

  // NASA POWER API endpoint
  const baseUrl = 'https://power.larc.nasa.gov/api/temporal/daily/point';
  
  // Parameters for precipitation data
  const parameters = 'PRECTOTCORR'; // Precipitation Corrected
  const community = 'AG'; // Agricultural community
  const format = 'JSON';
  
  // Build the full URL
  const url = `${baseUrl}?parameters=${parameters}&community=${community}&longitude=${lon}&latitude=${lat}&start=${startDate}&end=${endDate}&format=${format}`;
  
  try {
    console.log(`Fetching NASA POWER data from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000, // 30 second timeout (NASA can be slow)
      headers: {
        'User-Agent': 'Agricast/1.0 (Agricultural verification system)'
      }
    });
    
    // Process the NASA POWER response
    const processedData = processNASAResponse(response.data, lat, lon, startDate, endDate);
    
    // Cache the processed data for 24 hours (86400 seconds)
    await cacheData(cacheKey, processedData, 86400);
    
    return processedData;
    
  } catch (error) {
    console.error('NASA POWER fetch error:', error.message);
    
    if (error.response) {
      // NASA API returned an error
      if (error.response.status === 422) {
        throw new Error('Invalid coordinates or date range for NASA POWER');
      } else if (error.response.status === 404) {
        throw new Error('No NASA POWER data available for this location/time');
      }
    }
    
    throw new Error('Failed to fetch NASA POWER data: ' + error.message);
  }
}

/**
 * Process NASA POWER API response into our standard format
 */
function processNASAResponse(data, lat, lon, startDate, endDate) {
  try {
    // Extract the precipitation data
    const precipData = data.properties.parameter.PRECTOTCORR;
    
    // Convert to array format with dates
    const dailyData = [];
    let totalPrecipitation = 0;
    let daysWithData = 0;
    
    // NASA returns data as object with date keys
    for (const [dateKey, value] of Object.entries(precipData)) {
      if (value !== -999) { // -999 is NASA's missing data indicator
        dailyData.push({
          date: formatNASADate(dateKey),
          precipitation: value,
          unit: 'mm'
        });
        totalPrecipitation += value;
        daysWithData++;
      } else {
        dailyData.push({
          date: formatNASADate(dateKey),
          precipitation: null,
          unit: 'mm',
          note: 'No data available'
        });
      }
    }
    
    // Calculate statistics
    const averageDailyPrecipitation = daysWithData > 0 
      ? (totalPrecipitation / daysWithData).toFixed(2) 
      : "0.00"; // Return string to match toFixed(2)
    
    return {
      location: {
        latitude: lat,
        longitude: lon
      },
      period: {
        start: formatDateDisplay(startDate),
        end: formatDateDisplay(endDate),
        days: dailyData.length,
        daysWithData: daysWithData
      },
      summary: {
        totalPrecipitation: totalPrecipitation.toFixed(2),
        averageDaily: averageDailyPrecipitation,
        unit: 'mm',
        dataCompleteness: ((daysWithData / dailyData.length) * 100).toFixed(1) + '%'
      },
      daily: dailyData,
      metadata: {
        source: 'NASA POWER',
        parameter: 'PRECTOTCORR (Precipitation Corrected)',
        spatialResolution: '0.5 x 0.5 degree',
        temporalResolution: 'Daily',
        lastUpdated: data.header?.fill_value || 'Unknown' // Optional chaining for header
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error processing NASA response:', error);
    throw new Error('Failed to process NASA POWER data');
  }
}

/**
 * Format NASA date (YYYYMMDD) to readable format (YYYY-MM-DD)
 */
function formatNASADate(dateStr) {
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Format date (YYYYMMDD) for display (e.g., May 29, 2024)
 */
function formatDateDisplay(dateStr) {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-CA', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Get cached data from Firestore
 */
async function getCachedData(cacheKey) {
  try {
    const doc = await db.collection('cache').doc(cacheKey).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    // Assuming ttl is stored in seconds for this cache entry
    const age = (Date.now() - data.timestamp.toDate().getTime()) / 1000; 

    if (age > data.ttl) { // data.ttl should be defined (e.g., 86400 for 24 hours)
      console.log(`Cache expired for ${cacheKey}`);
      await db.collection('cache').doc(cacheKey).delete();
      return null;
    }
    
    console.log(`Cache hit for ${cacheKey}`);
    return data.value;
  } catch (error) {
    console.error('Cache fetch error:', error);
    return null;
  }
}

/**
 * Store data in Firestore cache
 */
async function cacheData(cacheKey, data, ttlSeconds) {
  try {
    const timestamp = admin.firestore.Timestamp.now();
    
    await db.collection('cache').doc(cacheKey).set({
      value: data,
      timestamp: timestamp,
      ttl: ttlSeconds // Store TTL in seconds
    });
    
    console.log(`Cached data for ${cacheKey} with TTL ${ttlSeconds}s`);
  } catch (error) {
    console.error('Cache store error:', error);
  }
}

/**
 * Validate date format (YYYYMMDD)
 */
function isValidDate(dateStr) {
  if (!/^\d{8}$/.test(dateStr)) {
    return false;
  }
  
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);
  
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}

module.exports = {
  fetchNASAPowerData,
  isValidDate
};
