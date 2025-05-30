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
      forecast: extractForecast(siteData.forecastGroup), // This might need adjustment
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
    
    // Add precipitation data using the new functions
    const precipitationForecasts = extractPrecipitationData(siteData.forecastGroup);
    const enhancedWeatherData = enhanceWeatherWithPrecipitation(weatherData, precipitationForecasts);

    return enhancedWeatherData; // Return the enhanced data

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
  return forecasts.slice(0, 5).map(fc => { // Original code slices to 5 days
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
    if ((Date.now() - data.timestamp.toDate().getTime()) > 300000) { 
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
      timestamp: admin.firestore.FieldValue.serverTimestamp() 
    });
  } catch (error) {
    console.error(`Cache write error for ${key}:`, error);
  }
}

// --- Appended Precipitation Functions ---

function extractPrecipitationData(forecastGroup) {
  const precipitationForecasts = [];
  // Ensure forecastGroup.forecast is an array, even if it's a single object
  const forecasts = Array.isArray(forecastGroup.forecast) 
    ? forecastGroup.forecast 
    : (forecastGroup.forecast ? [forecastGroup.forecast] : []);

  forecasts.forEach((period, index) => {
    const precipData = {
      period: period.period?.[0]?.textSummary?.[0] || period.period?.textForecastName || 'Unknown Period',
      probabilityOfPrecip: extractPoP(period),
      amounts: extractPrecipitationAmounts(period),
      precipitationType: extractPrecipitationType(period),
      timing: extractPrecipitationTiming(period), // This function was not provided, will add a placeholder
      confidence: calculateForecastConfidence(index)
    };
    precipitationForecasts.push(precipData);
  });
  return precipitationForecasts;
}

function extractPoP(forecastPeriod) {
  const abbreviatedText = forecastPeriod.abbreviatedForecast?.[0]?.textSummary?.[0] || '';
  const popMatch = abbreviatedText.match(/POP\s+(\d+)%/);
  if (popMatch) {
    return { value: parseInt(popMatch[1]), text: `${popMatch[1]}% chance` };
  }
  const textSummary = forecastPeriod.textSummary?.[0] || '';
  const percentMatch = textSummary.match(/(\d+)\s*percent chance/i);
  if (percentMatch) {
    return { value: parseInt(percentMatch[1]), text: `${percentMatch[1]}% chance` };
  }
  if (textSummary.includes('showers') || textSummary.includes('rain')) {
    if (textSummary.includes('chance of')) {
      return { value: 30, text: '30% chance (estimated)' };
    } else if (textSummary.includes('periods of')) {
      return { value: 70, text: '70% chance (estimated)' };
    }
  }
  return { value: 0, text: 'No precipitation expected' };
}

function extractPrecipitationAmounts(forecastPeriod) {
  const textSummary = forecastPeriod.textSummary?.[0] || '';
  const amounts = {
    rain: null, snow: null, total: null, unit: 'mm', timeframe: 'period'
  };
  const rainMatch = textSummary.match(/(\d+)\s*(?:to\s*(\d+))?\s*mm/i);
  if (rainMatch) {
    amounts.rain = {
      min: parseInt(rainMatch[1]),
      max: rainMatch[2] ? parseInt(rainMatch[2]) : parseInt(rainMatch[1]),
      expected: rainMatch[2] 
        ? Math.round((parseInt(rainMatch[1]) + parseInt(rainMatch[2])) / 2)
        : parseInt(rainMatch[1])
    };
    amounts.total = amounts.rain.expected;
  }
  const snowMatch = textSummary.match(/(\d+)\s*(?:to\s*(\d+))?\s*cm/i);
  if (snowMatch) {
    amounts.snow = {
      min: parseInt(snowMatch[1]),
      max: snowMatch[2] ? parseInt(snowMatch[2]) : parseInt(snowMatch[1]),
      expected: snowMatch[2]
        ? Math.round((parseInt(snowMatch[1]) + parseInt(snowMatch[2])) / 2)
        : parseInt(snowMatch[1])
    };
    amounts.total = (amounts.total || 0) + (amounts.snow.expected * 10); // Snow to water equivalent
    amounts.unit = 'mm water equivalent';
  }
  return amounts;
}

function extractPrecipitationType(forecastPeriod) {
  const textSummary = (forecastPeriod.textSummary?.[0] || '').toLowerCase();
  const types = [];
  if (textSummary.includes('freezing rain')) types.push('freezing_rain');
  if (textSummary.includes('ice pellets')) types.push('ice_pellets');
  if (textSummary.includes('snow') && !textSummary.includes('no snow')) types.push('snow');
  if (textSummary.includes('rain') && !textSummary.includes('freezing rain')) types.push('rain');
  if (textSummary.includes('drizzle')) types.push('drizzle');
  if (textSummary.includes('showers')) types.push('showers');
  if (textSummary.includes('thunderstorm')) types.push('thunderstorm');
  return types.length > 0 ? types : ['none'];
}

// Placeholder for extractPrecipitationTiming as it was not defined in the provided code
function extractPrecipitationTiming(forecastPeriod) {
  const textSummary = (forecastPeriod.textSummary?.[0] || '').toLowerCase();
  if (textSummary.includes('ending')) return 'ending';
  if (textSummary.includes('beginning')) return 'beginning';
  if (textSummary.includes('near noon')) return 'near noon';
  if (textSummary.includes('overnight')) return 'overnight';
  if (textSummary.includes('morning')) return 'morning';
  if (textSummary.includes('afternoon')) return 'afternoon';
  if (textSummary.includes('evening')) return 'evening';
  return 'throughout period';
}

function calculateForecastConfidence(dayIndex) {
  if (dayIndex === 0) return 'high';
  if (dayIndex <= 2) return 'medium-high';
  if (dayIndex <= 4) return 'medium';
  return 'low';
}

function enhanceWeatherWithPrecipitation(weatherData, precipitationForecasts) {
  const next7DaysTotal = precipitationForecasts.slice(0, 7).reduce((total, day) => total + (day.amounts.total || 0), 0);
  const next3DaysTotal = precipitationForecasts.slice(0, 3).reduce((total, day) => total + (day.amounts.total || 0), 0);
  const dryWindows = findDryWindows(precipitationForecasts);
  
  weatherData.precipitation = {
    forecast: precipitationForecasts,
    summary: {
      next24Hours: precipitationForecasts[0]?.amounts.total || 0,
      next3Days: next3DaysTotal,
      next7Days: next7DaysTotal,
      dryWindows: dryWindows,
      fieldworkRecommendation: generateFieldworkRecommendation(precipitationForecasts, dryWindows)
    }
  };
  return weatherData;
}

function findDryWindows(precipitationForecasts) {
  const dryWindows = [];
  let currentWindow = null;
  precipitationForecasts.forEach((forecast, index) => {
    const isDry = forecast.probabilityOfPrecip.value < 30 && (!forecast.amounts.total || forecast.amounts.total < 2);
    if (isDry) {
      if (!currentWindow) {
        currentWindow = { start: index, startPeriod: forecast.period, length: 1 };
      } else {
        currentWindow.length++;
      }
    } else {
      if (currentWindow && currentWindow.length >= 2) {
        currentWindow.end = index - 1;
        currentWindow.endPeriod = precipitationForecasts[index - 1].period;
        dryWindows.push(currentWindow);
      }
      currentWindow = null;
    }
  });
  if (currentWindow && currentWindow.length >= 2) {
    currentWindow.end = precipitationForecasts.length - 1;
    currentWindow.endPeriod = precipitationForecasts[precipitationForecasts.length - 1].period;
    dryWindows.push(currentWindow);
  }
  return dryWindows;
}

function generateFieldworkRecommendation(forecasts, dryWindows) {
  const next48Hours = forecasts.slice(0, 4); // Assuming 12-hour periods
  const significantRainComing = next48Hours.some(f => f.amounts.total && f.amounts.total > 10);
  if (significantRainComing) {
    return { status: 'urgent', message: 'Complete critical fieldwork within next 24 hours if possible', reasoning: 'Significant precipitation expected' };
  }
  if (dryWindows.length > 0 && dryWindows[0].start === 0) {
    return { status: 'favorable', message: `Good conditions for fieldwork over next ${dryWindows[0].length} periods`, reasoning: 'Extended dry window available' };
  }
  return { status: 'plan_ahead', message: 'Mixed conditions - plan fieldwork around dry windows', reasoning: 'Intermittent precipitation expected' };
}

// --- End of Appended Functions ---

// Modify module.exports to include new functions if they are to be used by other modules
// For now, only fetchECCCWeather is the main public function from this file.
// If getWeatherWithInsights is a new top-level function, it should be defined here and exported.

// Placeholder for getWeatherWithInsights if it's intended to be different from fetchECCCWeather
// For now, we assume fetchECCCWeather is what gets called, and it now includes precipitation.
async function getWeatherWithInsights(province, stationCode) {
  // This function will be similar to fetchECCCWeather but might include more processing
  // For this implementation, it will call fetchECCCWeather which now includes precipitation data
  const weatherData = await fetchECCCWeather(province, stationCode);
  // Potentially add more insights here if needed, or just return as is
  return weatherData;
}


module.exports = {
  fetchECCCWeather, // Original function, now enhanced
  getWeatherWithInsights, // New function that leverages the enhanced fetchECCCWeather
  getCachedData,
  cacheData
  // Potentially export other functions if needed directly by other modules
};
