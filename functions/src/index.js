const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const weatherService = require('./services/weather');
const nasaService = require('./services/nasa');
const calculations = require('./services/calculations'); // Added calculations service
// const alertsService = require('./services/alerts'); // For when alert functions are added

exports.getWeather = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { province, station } = req.query;
      if (!province || !station) {
        return res.status(400).json({ error: 'Province and station query parameters are required.' });
      }
      const cacheKey = `weather_${province}_${station}`;
      let weatherData = await weatherService.getCachedData(cacheKey);
      if (weatherData) {
        console.log(`Returning cached ECCC weather data for ${province}/${station}`);
        res.set('X-Cache-Hit', 'true');
        return res.json(weatherData);
      }
      console.log(`Fetching fresh ECCC weather data for ${province}/${station}`);
      weatherData = await weatherService.fetchECCCWeather(province, station);
      weatherService.cacheData(cacheKey, weatherData, 300); 
      res.set('X-Cache-Hit', 'false');
      res.json(weatherData);
    } catch (error) {
      console.error('Error in getWeather function:', error.message);
      if (error.message.includes('Invalid location')) {
        res.status(404).json({ error: error.message });
      } else if (error.message.includes('timeout')) {
        res.status(504).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to fetch ECCC weather: ' + error.message });
      }
    }
  });
});

exports.getNASAPowerData = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { lat, lon, startDate, endDate } = req.query;
      if (!lat || !lon || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing params: lat, lon, startDate, endDate' });
      }
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid coordinates.' });
      }
      if (!nasaService.isValidDate(startDate) || !nasaService.isValidDate(endDate)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYYMMDD' });
      }
      if (startDate > endDate) {
        return res.status(400).json({ error: 'Start date must be before end date' });
      }
      const nasaData = await nasaService.fetchNASAPowerData(latitude, longitude, startDate, endDate);
      res.json(nasaData);
    } catch (error) {
      console.error('getNASAPowerData error:', error.message);
      if (error.message.includes('Invalid') || error.message.includes('No NASA POWER data')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to fetch NASA POWER data', details: error.message });
    }
  });
});

exports.getMultipleStations = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const stationsQuery = req.query.stations;
      if (!stationsQuery) {
        return res.status(400).json({ error: 'Missing stations query (e.g., stations=MB/s0000193,AB/s0000047)' });
      }
      const stationPairs = stationsQuery.split(',');
      const promises = stationPairs.map(s => {
        const parts = s.split('/');
        if (parts.length !== 2) {
          return Promise.resolve({ station: s, error: 'Invalid format. Use PROVINCE/STATIONCODE.' });
        }
        const [province, station] = parts;
        return weatherService.fetchECCCWeather(province, station)
          .catch(err => ({ station: s, error: err.message }));
      });
      const results = await Promise.all(promises);
      res.json(results);
    } catch (error) {
      console.error('Error in getMultipleStations:', error);
      res.status(500).json({ error: 'Failed to fetch for multiple stations.' });
    }
  });
});

// New enhanced weather endpoint with insights
exports.getWeatherWithInsights = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      const { province, station } = req.query;
      if (!province || !station) {
        return res.status(400).json({ error: 'Province and station query parameters are required.' });
      }

      // Fetch base weather data (using the existing service, which includes caching)
      const weatherData = await weatherService.fetchECCCWeather(province, station);
      
      if (!weatherData || !weatherData.current || !weatherData.forecast) {
        // This case might be handled by fetchECCCWeather throwing an error, but double check
        return res.status(404).json({ error: 'Base weather data not found or incomplete.' });
      }

      // Add calculated insights
      // Ensure forecast data for GDD is available and has high/low, provide defaults if not.
      const firstForecastDay = weatherData.forecast && weatherData.forecast.length > 0 ? weatherData.forecast[0] : {};
      const tempHighForGDD = parseFloat(firstForecastDay.temperature?.high || weatherData.current.temperature); // Fallback to current if forecast high not avail
      const tempLowForGDD = parseFloat(firstForecastDay.temperature?.low || weatherData.current.temperature);   // Fallback to current if forecast low not avail

      const insights = {
        spray: calculations.calculateSprayConditions(weatherData),
        drying: calculations.calculateDryingConditions(weatherData),
        frost: calculations.calculateFrostRisk(weatherData),
        gdd: {
          // Example for corn with base 10°C, max 30°C
          corn_base10_max30: calculations.calculateGDD(tempHighForGDD, tempLowForGDD, 10, 30),
          // Example for canola with base 5°C, max 30°C (canola GDD often uses no max cap or a higher one like 35)
          canola_base5_max30: calculations.calculateGDD(tempHighForGDD, tempLowForGDD, 5, 30)
        },
        chu: calculations.calculateCHU(tempHighForGDD, tempLowForGDD)
      };
      
      res.json({
        ...weatherData,
        insights
      });
      
    } catch (error) {
      console.error('Error in getWeatherWithInsights:', error.message);
      if (error.message.includes('Invalid location') || error.message.includes('Base weather data not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to get weather with insights: ' + error.message });
      }
    }
  });
});

