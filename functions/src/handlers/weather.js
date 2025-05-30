// functions/src/handlers/weather.js
const { fetchECCCWeather, getWeatherWithInsights } = require('../services/weather'); 
const { validateRequest } = require('../middleware/auth');
const { logUsage } = require('../services/analytics'); // Uncommented: analytics service
const cors = require('cors')({ origin: true });

async function handleGetWeather(req, res) {
  return cors(req, res, async () => {
    try {
      const auth = await validateRequest(req); // Integrated validateRequest
      
      const { province, station } = req.query;
      if (!province || !station) {
        return res.status(400).json({
          error: 'Missing required parameters: province and station'
        });
      }
      
      await logUsage(auth.uid, 'weather_basic', { province, station }); // Uncommented: logUsage call
      
      const weatherData = await fetchECCCWeather(province, station); 
      
      return res.json({
        apiVersion: 'v1',
        data: weatherData,
        timestamp: new Date().toISOString(),
        // authType: auth.type // Optional: for debugging auth flow
      });
      
    } catch (error) {
      console.error('Weather API error:', error);
      return res.status(500).json({
        error: 'Failed to fetch weather data',
        message: error.message
      });
    }
  });
}

async function handleGetWeatherWithInsights(req, res) {
  return cors(req, res, async () => {
    try {
      const auth = await validateRequest(req); // Integrated validateRequest
      
      const { province, station } = req.query;
      if (!province || !station) {
        return res.status(400).json({
          error: 'Missing required parameters: province and station'
        });
      }
      
      await logUsage(auth.uid, 'weather_insights', { province, station }); // Uncommented: logUsage call
      
      const weatherData = await getWeatherWithInsights(province, station);
      
      return res.json({
        apiVersion: 'v1',
        data: weatherData,
        timestamp: new Date().toISOString(),
        // authType: auth.type // Optional: for debugging auth flow
      });
      
    } catch (error) {
      console.error('Weather Insights API error:', error);
      return res.status(500).json({
        error: 'Failed to fetch weather insights',
        message: error.message
      });
    }
  });
}

module.exports = {
  handleGetWeather,
  handleGetWeatherWithInsights
};
