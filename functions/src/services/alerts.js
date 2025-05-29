const admin = require('firebase-admin');

// Ensure Firebase Admin is initialized (idempotent)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Import calculations service needed for some alert types
const calculations = require('./calculations');

/**
 * Check if alert conditions are met for a given user and current weather data.
 * @param {string} userId - The ID of the user.
 * @param {Object} weatherData - The comprehensive weather data object (from ECCC, including insights perhaps).
 * @returns {Array} An array of triggered alert objects.
 */
async function checkAlertConditions(userId, weatherData) {
  const userAlertsRef = db.collection('users').doc(userId).collection('alerts');
  let alertsSnapshot;
  try {
    alertsSnapshot = await userAlertsRef.where('enabled', '==', true).get();
  } catch (error) {
    console.error(`Failed to retrieve alerts for user ${userId}:`, error);
    return []; // Return empty if alerts can't be fetched
  }

  if (alertsSnapshot.empty) {
    console.log(`No enabled alerts found for user ${userId}`);
    return [];
  }

  const triggeredAlerts = [];
  alertsSnapshot.forEach(doc => {
    const alert = { id: doc.id, ...doc.data() };
    
    // Ensure weatherData is passed to shouldTriggerAlert
    if (shouldTriggerAlert(alert, weatherData)) {
      triggeredAlerts.push({
        alertName: alert.name,
        alertType: alert.type,
        triggeredAt: new Date().toISOString(),
        // Including a snapshot of relevant current conditions that triggered the alert
        weatherSnapshot: {
          temperature: weatherData.current.temperature,
          windSpeed: weatherData.current.windSpeed,
          condition: weatherData.current.condition,
          // Add more relevant fields based on alert type if necessary
        },
        message: generateAlertMessage(alert, weatherData) // Generate a human-readable message
      });
    }
  });

  return triggeredAlerts;
}

/**
 * Determine if a specific alert should trigger based on weather data.
 */
function shouldTriggerAlert(alert, weatherData) {
  const current = weatherData.current;
  if (!current) return false; // Should not happen if weatherData is valid

  try {
    switch (alert.type) {
      case 'SPRAY_CONDITIONS':
        // Assuming calculateSprayConditions is now part of the weatherData.insights object
        const sprayInsights = weatherData.insights?.spray || calculations.calculateSprayConditions(weatherData);
        return sprayInsights.overall.canSpray === alert.condition; // alert.condition should be true or false
        
      case 'WIND_THRESHOLD':
        if (typeof current.windSpeed !== 'number' || typeof alert.threshold !== 'number') return false;
        return alert.operator === 'below' 
          ? current.windSpeed <= alert.threshold
          : current.windSpeed >= alert.threshold;
          
      case 'TEMPERATURE':
        if (typeof current.temperature !== 'number' || typeof alert.threshold !== 'number') return false;
        return alert.operator === 'below'
          ? current.temperature <= alert.threshold
          : current.temperature >= alert.threshold;
          
      case 'FROST_RISK':
        const frostInsights = weatherData.insights?.frost || calculations.calculateFrostRisk(weatherData);
        return frostInsights.tonight_risk_level === alert.riskLevel; // e.g., alert.riskLevel could be 'HIGH', 'MEDIUM'
        
      case 'RAIN_EXPECTED':
        if (!weatherData.forecast || typeof alert.threshold !== 'number') return false;
        return weatherData.forecast.some(day => 
          day.pop && parseFloat(day.pop) >= alert.threshold
        );
        
      default:
        console.warn(`Unknown alert type: ${alert.type}`);
        return false;
    }
  } catch (e) {
    console.error(`Error in shouldTriggerAlert for type ${alert.type}:`, e);
    return false;
  }
}

/**
 * Generates a human-readable message for a triggered alert.
 */
function generateAlertMessage(alert, weatherData) {
  const current = weatherData.current;
  switch (alert.type) {
    case 'SPRAY_CONDITIONS':
      return alert.condition ? \`Good news! Spraying conditions are now favorable near ${weatherData.location.city}.\` : \` Heads up! Spraying conditions are no longer favorable near ${weatherData.location.city}.\`;
    case 'WIND_THRESHOLD':
      return `Wind speed alert: Currently ${current.windSpeed} km/h near ${weatherData.location.city}, which is ${alert.operator} your threshold of ${alert.threshold} km/h.`;
    case 'TEMPERATURE':
      return `Temperature alert: Currently ${current.temperature}°C near ${weatherData.location.city}, which is ${alert.operator} your threshold of ${alert.threshold}°C.`;
    case 'FROST_RISK':
      const frostInsights = weatherData.insights?.frost || calculations.calculateFrostRisk(weatherData);
      return `Frost risk update for ${weatherData.location.city}: Tonight's risk is ${frostInsights.tonight_risk_level}. Factors: ${frostInsights.factors.join(', ') || 'None specified'}.`;
    case 'RAIN_EXPECTED':
      return `Rainfall probability has reached your threshold of ${alert.threshold}% for an upcoming period near ${weatherData.location.city}.`;
    default:
      return `Alert triggered for ${alert.name || alert.type}.`;
  }
}

/**
 * Create default alerts for a new user.
 * @param {string} userId - The ID of the user.
 */
async function createDefaultAlerts(userId) {
  const defaultAlerts = [
    {
      name: 'Optimal Spray Window Alert',
      type: 'SPRAY_CONDITIONS',
      condition: true, // Trigger when conditions ARE good
      enabled: true,
      description: 'Notifies when temperature, wind, and humidity are suitable for spraying.'
    },
    {
      name: 'High Frost Risk Warning',
      type: 'FROST_RISK',
      riskLevel: 'HIGH', // Trigger for HIGH risk
      enabled: true,
      description: 'Notifies when there is a high risk of frost tonight.'
    },
    {
      name: 'High Wind Speed Warning',
      type: 'WIND_THRESHOLD',
      operator: 'above',
      threshold: 25, // km/h
      enabled: true,
      description: 'Notifies when wind speed exceeds 25 km/h.'
    },
    {
      name: 'Low Temperature Warning (Planting/Growth)',
      type: 'TEMPERATURE',
      operator: 'below',
      threshold: 5, // °C
      enabled: false, // Disabled by default, user can enable
      description: 'Notifies if temperature drops below 5°C during growing season.'
    }
  ];

  const batch = db.batch();
  const alertsCollectionRef = db.collection('users').doc(userId).collection('alerts');

  defaultAlerts.forEach(alert => {
    // Use a consistent ID or let Firestore generate one if duplicates are okay or handled differently
    const alertRef = alertsCollectionRef.doc(alert.type + (alert.condition !== undefined ? '_'+String(alert.condition) : '') + (alert.riskLevel ? '_'+alert.riskLevel : '') + (alert.operator ? '_'+alert.operator+'_'+alert.threshold : '') );
    batch.set(alertRef, {
      ...alert,
      isDefault: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastChecked: null, // Timestamp of last check
      lastTriggered: null // Timestamp of last trigger
    });
  });

  try {
    await batch.commit();
    console.log(`Default alerts created for user ${userId}`);
  } catch (error) {
    console.error(`Failed to create default alerts for user ${userId}:`, error);
  }
}

module.exports = {
  checkAlertConditions,
  createDefaultAlerts,
  shouldTriggerAlert // Exporting for potential direct use or testing
};
