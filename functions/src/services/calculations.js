/**
 * Agricultural calculations from weather data
 */

// Placeholder for a more sophisticated forecast analysis
function findBestSprayWindow(forecast) {
  // TODO: Implement logic to find the best 2-4 hour spray window from hourly forecast if available
  // For now, returns a generic message or null
  if (forecast && forecast.length > 0) {
    // This is a simplistic check on the first available forecast period
    const firstGoodPeriod = forecast.find(f => {
      const high = f.temperature?.high;
      const low = f.temperature?.low;
      // Example: Needs a day forecast with moderate temperature
      return high && high > 5 && high < 28;
    });
    if (firstGoodPeriod) {
      return `Consider spraying during ${firstGoodPeriod.period.toLowerCase()} if other conditions (wind, humidity) are met.`;
    }
  }
  return 'No ideal window identified with current daily forecast data. Check hourly if available.';
}

/**
 * Calculate Growing Degree Days (GDD)
 * Essential for crop staging and maturity predictions
 */
function calculateGDD(tempMax, tempMin, baseTemp = 10, maxThreshold = 30) {
  // Temperatures are capped at maxThreshold, and floored at baseTemp for GDD calculation method
  const adjMax = Math.min(Math.max(tempMax, baseTemp), maxThreshold);
  const adjMin = Math.min(Math.max(tempMin, baseTemp), maxThreshold); // Some methods use baseTemp for min as well
  
  const avgTemp = (adjMax + adjMin) / 2;
  return Math.max(0, avgTemp - baseTemp);
}

/**
 * Calculate Corn Heat Units (CHU) - Ontario/Eastern Canada method
 */
function calculateCHU(tempMax, tempMin) {
  // Daily maximum temperature contribution (Ymax)
  let yMax = 0;
  if (tempMax > 10) { // CHU accumulation starts above 10°C for max temp
    yMax = 3.33 * (tempMax - 10) - 0.084 * Math.pow(Math.max(0, tempMax - 10), 2);
  }

  // Daily minimum temperature contribution (Ymin)
  let yMin = 0;
  if (tempMin > 4.4) { // CHU accumulation starts above 4.4°C for min temp
    yMin = 1.8 * (tempMin - 4.4);
  }
  
  return Math.max(0, yMax) + Math.max(0, yMin); // CHU cannot be negative, sum of positive contributions
}

/**
 * Determine if conditions are suitable for spraying
 */
function calculateSprayConditions(weather) {
  const wind = weather.current.windSpeed;
  const temp = weather.current.temperature;
  const humidity = weather.current.humidity;
  
  const conditions = {
    temperature: {
      value: temp,
      suitable: temp >= 5 && temp <= 28, // Adjusted upper limit slightly
      reason: temp < 5 ? 'Too cold - reduced herbicide efficacy' : 
               temp > 28 ? 'Too hot - increased drift and volatility' : 'Good'
    },
    wind: {
      value: wind,
      suitable: wind >= 3 && wind <= 15,
      reason: wind < 3 ? 'Too calm - potential for inversion layer' : 
               wind > 15 ? 'Too windy - high drift risk' : 'Good'
    },
    humidity: {
      value: humidity,
      suitable: humidity >= 40 && humidity <= 80, // Adjusted upper limit slightly
      reason: humidity < 40 ? 'Too dry - rapid droplet evaporation' : 
               humidity > 80 ? 'Too humid - slow drying, reduced absorption' : 'Good'
    },
    overall: {
      canSpray: false,
      bestWindow: null
    }
  };
  
  conditions.overall.canSpray = conditions.temperature.suitable && 
                                conditions.wind.suitable && 
                                conditions.humidity.suitable;
  
  if (weather.forecast && weather.forecast.length > 0) {
    conditions.overall.bestWindow = findBestSprayWindow(weather.forecast);
  }
  
  return conditions;
}

/**
 * Calculate drying conditions for harvest
 */
function calculateDryingConditions(weather) {
  const temp = weather.current.temperature;
  const humidity = weather.current.humidity;
  const wind = weather.current.windSpeed;
  
  // More standard EMC formula for grains (Henderson-Thompson or similar simplified)
  // This is a very simplified version. Actual EMC depends on grain type.
  // For a generic approach, relative humidity is the main driver.
  // Lower RH = better drying. Higher temp = better drying (to a point).
  let EMC = 0;
  if (humidity > 0) { // Avoid division by zero or log of zero
    EMC = 100 * (Math.log(1 - (humidity / 100)) / (-0.0005 * (temp + 20)));
    EMC = Math.max(0, Math.min(EMC, 40)); // Cap EMC at reasonable values
  } else {
    EMC = 5; // Very dry if RH is 0
  }
  
  // Drying rate score (0-100) - higher is better
  const tempScore = Math.max(0, Math.min(temp, 30)) / 30 * 35;       // Max 35 points for temp up to 30C
  const humidityScore = Math.max(0, (100 - humidity) / 100 * 45); // Max 45 points for low humidity
  const windScore = Math.min(wind, 25) / 25 * 20;                  // Max 20 points for wind up to 25 km/h
  
  const dryingScore = Math.round(tempScore + humidityScore + windScore);
  
  let rating = 'Poor';
  if (dryingScore >= 75) rating = 'Excellent';
  else if (dryingScore >= 60) rating = 'Good';
  else if (dryingScore >= 40) rating = 'Fair';

  return {
    EMC_estimated_percent: EMC.toFixed(1),
    dryingScore_out_of_100: Math.min(100, dryingScore), // Ensure score doesn't exceed 100
    rating: rating,
    details: {
      temperature_C: `${temp}`,
      humidity_percent: `${humidity}`,
      wind_kmh: `${wind}`
    }
  };
}

/**
 * Frost risk assessment
 */
function calculateFrostRisk(weather) {
  const currentTemp = weather.current.temperature;
  const windSpeed = weather.current.windSpeed;
  const condition = weather.current.condition ? weather.current.condition.toLowerCase() : '';
  
  // Use forecasted low if available and more reliable
  let forecastedLow = null;
  if (weather.forecast && weather.forecast[0] && weather.forecast[0].temperature?.low !== null) {
    forecastedLow = parseFloat(weather.forecast[0].temperature.low);
  }

  const effectiveTempForRisk = forecastedLow !== null ? forecastedLow : currentTemp - 3; // Fallback rough estimate

  const risk = {
    current_temp_C: currentTemp,
    expected_low_C: forecastedLow !== null ? forecastedLow : 'Not in immediate forecast',
    tonight_risk_level: 'LOW',
    factors: []
  };

  if (effectiveTempForRisk <= 0) {
    risk.tonight_risk_level = 'HIGH';
    risk.factors.push('Temperature expected to drop to 0°C or below.');
  } else if (effectiveTempForRisk <= 2) {
    risk.tonight_risk_level = 'MEDIUM';
    risk.factors.push('Temperature expected to drop near 0-2°C, light frost possible.');
  } else if (effectiveTempForRisk <= 4) {
    risk.tonight_risk_level = 'LOW'; // Still low, but mention it
     risk.factors.push('Temperatures expected to remain above 2-4°C, but monitor if skies clear.');
  }

  if (windSpeed < 8 && (condition.includes('clear') || condition.includes('a few clouds'))) {
    risk.factors.push('Clear skies and light winds increase radiative cooling and frost risk.');
    if (risk.tonight_risk_level === 'LOW' && effectiveTempForRisk <= 5) risk.tonight_risk_level = 'MEDIUM'; // Bump up risk if conditions are prime
  }
  
  if (weather.current.dewpoint && effectiveTempForRisk <= weather.current.dewpoint && effectiveTempForRisk <=2) {
      risk.factors.push('Temperature may drop to dew point, increasing frost intensity if below freezing.')
  }

  if (risk.factors.length === 0 && risk.tonight_risk_level === 'LOW') {
    risk.factors.push('Currently, frost risk appears low based on available data.');
  }
  
  return risk;
}

module.exports = {
  calculateGDD,
  calculateCHU,
  calculateSprayConditions,
  calculateDryingConditions,
  calculateFrostRisk,
  findBestSprayWindow // Exporting the placeholder
};
