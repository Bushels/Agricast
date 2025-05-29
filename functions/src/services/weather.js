const axios = require('axios');
const xml2js = require('xml2js');
const admin = require('firebase-admin');

// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

async function fetchECCCWeather(province, stationCode) {
  const url = `https://dd.weather.gc.ca/citypage_weather/xml/${province}/${stationCode}_e.xml`;

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Agricast/1.0 (Weather verification for farmers)' }
    });

    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true
    });

    const result = await parser.parseStringPromise(response.data);
    const siteData = result.siteData;

    if (!siteData || !siteData.location || !siteData.currentConditions) {
      throw new Error('Weather data structure is invalid or missing key elements.');
    }

    const weatherData = {
      location: {
        city: siteData.location.name._,
        province: siteData.location.province.code,
        lat: parseFloat(siteData.location.name.lat),
        lon: parseFloat(siteData.location.name.lon)
      },
      current: {
        temperature: parseFloat(siteData.currentConditions.temperature._),
        condition: siteData.currentConditions.condition,
        humidity: parseFloat(siteData.currentConditions.relativeHumidity._),
        windSpeed: parseFloat(siteData.currentConditions.wind.speed._),
        windDirection: siteData.currentConditions.wind.direction,
        pressure: parseFloat(siteData.currentConditions.pressure._),
        visibility: parseFloat(siteData.currentConditions.visibility._),
        observationTime: siteData.currentConditions.dateTime[1].textSummary
      },
      forecast: extractForecast(siteData.forecastGroup),
      almanac: {
        extremeMax: siteData.almanac?.temperature?.extremeMax?._ ? parseFloat(siteData.almanac.temperature.extremeMax._) : null,
        extremeMin: siteData.almanac?.temperature?.extremeMin?._ ? parseFloat(siteData.almanac.temperature.extremeMin._) : null,
        normalMax: siteData.almanac?.temperature?.normalMax?._ ? parseFloat(siteData.almanac.temperature.normalMax._) : null,
        normalMin: siteData.almanac?.temperature?.normalMin?._ ? parseFloat(siteData.almanac.temperature.normalMin._) : null,
        pop: siteData.almanac?.pop?._ || null
      },
      timestamp: new Date().toISOString(),
      source: 'ECCC'
    };

    return weatherData;

  } catch (error) {
    console.error(`Error fetching ECCC weather from ${url}:`, error.message);
    if (error.response) {
      console.error('Error Response Data:', error.response.data);
      console.error('Error Response Status:', error.response.status);
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Weather service timeout - ECCC may be slow to respond');
    } else if (error.response && error.response.status === 404) {
      throw new Error(`Invalid location or station code: ${province}/${stationCode}`);
    } else {
      throw new Error('Failed to fetch or parse weather data: ' + error.message);
    }
  }
}

function extractForecast(forecastGroup) {
  if (!forecastGroup || !forecastGroup.forecast) {
    return [];
  }
  const forecasts = Array.isArray(forecastGroup.forecast)
    ? forecastGroup.forecast
    : [forecastGroup.forecast];
  return forecasts.slice(0, 5).map(fc => {
    let highTempObj = null;
    let lowTempObj = null;
    if (fc.temperatures && fc.temperatures.temperature) {
      const tempEntry = fc.temperatures.temperature;
      if (Array.isArray(tempEntry)) {
        highTempObj = tempEntry.find(t => t.class === 'high');
        lowTempObj = tempEntry.find(t => t.class === 'low');
      } else if (typeof tempEntry === 'object' && tempEntry !== null) {
        if (tempEntry.class === 'high') highTempObj = tempEntry;
        else if (tempEntry.class === 'low') lowTempObj = tempEntry;
      }
    }
    return {
      period: fc.period?.textForecastName,
      summary: fc.textSummary,
      temperature: {
        high: highTempObj?._ ? parseFloat(highTempObj._) : null,
        low: lowTempObj?._ ? parseFloat(lowTempObj._) : null
      },
      pop: fc.abbreviatedForecast?.pop?._ || '0'
    };
  });
}

async function getCachedData(key) {
  try {
    const doc = await db.collection('cache').doc(key).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if ((Date.now() - data.timestamp.toDate().getTime()) > 300000) { // Compare with toDate().getTime() for Firestore timestamp
      await db.collection('cache').doc(key).delete();
      return null;
    }
    return data.value;
  } catch (error) {
    console.error(`Cache read error for ${key}:`, error);
    return null;
  }
}

async function cacheData(key, value) {
  try {
    await db.collection('cache').doc(key).set({
      value: value,
      timestamp: admin.firestore.FieldValue.serverTimestamp() // Use server timestamp for consistency
    });
  } catch (error) {
    console.error(`Cache write error for ${key}:`, error);
  }
}

module.exports = {
  fetchECCCWeather,
  getCachedData,
  cacheData
};
