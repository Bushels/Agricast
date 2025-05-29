# Agricast - Agricultural Weather Intelligence Platform

## Project Overview

Agricast is a comprehensive agricultural weather intelligence platform designed to provide Canadian farmers with real-time weather data, calculated agricultural metrics, and actionable insights for farming operations. The platform integrates multiple data sources including Environment and Climate Change Canada (ECCC) weather stations and NASA POWER satellite data.

## Current Implementation Status

### ✅ Completed Features

1. **ECCC Weather Integration**
   - Real-time weather data from Environment Canada stations
   - 7-day forecasts with hourly breakdown
   - Caching system (5-minute TTL) to reduce API calls
   - Support for multiple weather stations

2. **NASA POWER Satellite Data**
   - Historical precipitation data with global coverage
   - 50km x 50km resolution
   - 24-hour caching for efficiency
   - Note: Has 2-3 day data lag (not suitable for real-time)

3. **Agricultural Calculations Service**
   - Growing Degree Days (GDD) calculation
   - Corn Heat Units (CHU) calculation
   - Spray condition assessment (wind, temperature, humidity)
   - Drying conditions for harvest
   - Frost risk analysis

4. **Alert System Framework**
   - Customizable weather alerts
   - Condition-based triggers
   - User preference storage in Firestore

### 🚧 In Progress / Planned

- Frontend React application connection
- User authentication system
- Push notification system for alerts
- Historical data aggregation
- Mobile app development
- Multi-language support (French/English)

## Tech Stack

- **Backend**: Node.js with Firebase Cloud Functions
- **Database**: Firebase Firestore
- **APIs**: 
  - Environment Canada XML Weather API
  - NASA POWER REST API
- **Frontend**: React (to be connected)
- **Testing**: Jest
- **Development**: Firebase Emulators

## Project Structure

```
agricast/
├── functions/
│   ├── src/
│   │   ├── index.js              # Cloud Functions endpoints
│   │   └── services/
│   │       ├── weather.js        # ECCC weather integration
│   │       ├── nasa.js           # NASA POWER integration
│   │       ├── calculations.js   # Agricultural calculations
│   │       └── alerts.js         # Alert system
│   ├── test/
│   │   ├── weather.test.js       # Weather service tests
│   │   └── nasa.test.js          # NASA service tests
│   └── package.json
├── mobile/                       # React Native app (empty)
├── web/                         # React web app (empty)
├── firebase.json                # Firebase configuration
├── firestore.rules             # Security rules
└── .firebaserc                 # Project configuration
```

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Git configured
- Firebase project created (replace `agricast-your-project-id` with actual ID)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Bushels/Agricast.git
cd agricast
```

2. Install dependencies:
```bash
# Root dependencies (if any, currently minimal)
# npm install

# Cloud Functions dependencies
cd functions
npm install
cd ..
```

3. Update Firebase project ID:
```bash
# Edit .firebaserc and replace 'agricast-your-project-id' with your actual project ID
```

4. Start Firebase emulators:
```bash
firebase emulators:start
```

The emulators will start on (default ports, check your firebase.json for actual used ports):
- Functions: http://127.0.0.1:5001 (or the port you configured, e.g., 5002)
- Firestore: http://127.0.0.1:8080 (or the port you configured, e.g., 8081)
- Emulator UI: http://127.0.0.1:4000 (or the port you configured, e.g., 4001)

## API Endpoints

(Note: Replace `agricast-your-project-id` with your actual project ID and use the correct port for the Functions emulator as configured in your `firebase.json`, e.g., 5002)

### 1. Get Weather Data
```bash
GET /getWeather?province=MB&station=s0000193

# Example:
curl "http://127.0.0.1:5002/agricast-your-project-id/us-central1/getWeather?province=MB&station=s0000193"
```

Response includes current conditions and 7-day forecast.

### 2. Get Weather with Agricultural Insights
```bash
GET /getWeatherWithInsights?province=MB&station=s0000193

# Example:
curl "http://127.0.0.1:5002/agricast-your-project-id/us-central1/getWeatherWithInsights?province=MB&station=s0000193"
```

Response includes weather data plus:
- Spray condition assessment
- Drying conditions score
- Frost risk analysis
- Growing Degree Days

### 3. Get NASA Precipitation Data
```bash
GET /getNASAPowerData?lat=49.8954&lon=-97.1385&startDate=YYYYMMDD&endDate=YYYYMMDD

# Example (replace dates):
curl "http://127.0.0.1:5002/agricast-your-project-id/us-central1/getNASAPowerData?lat=49.8954&lon=-97.1385&startDate=20250522&endDate=20250529"
```

### 4. Get Multiple Weather Stations
```bash
GET /getMultipleStations?stations=MB/s0000193,AB/s0000047

# Example:
curl "http://127.0.0.1:5002/agricast-your-project-id/us-central1/getMultipleStations?stations=MB/s0000193,AB/s0000047"
```

## Key Calculations Explained

### Growing Degree Days (GDD)
- Used for crop development tracking
- Formula: `GDD = ((Tmax + Tmin) / 2) - Tbase`
- Different base temperatures for different crops (corn: 10°C, canola: 5°C)

### Spray Conditions
Evaluates if conditions are suitable for pesticide application:
- **Temperature**: 5-28°C (optimal efficacy)
- **Wind**: 3-15 km/h (prevents drift, avoids inversions)
- **Humidity**: 40-80% (proper droplet formation and drying)

### Drying Score
0-100 score based on:
- Temperature (35% weight)
- Humidity (45% weight)
- Wind speed (20% weight)

### Frost Risk
- **HIGH**: Expected low ≤ 0°C
- **MEDIUM**: Expected low ≤ 2°C
- **LOW**: Temperatures above thresholds, considering clear skies and light winds.

## Common Weather Station Codes

### Manitoba
- Winnipeg: `MB/s0000193`
- Brandon: `MB/s0000492`
- Portage la Prairie: `MB/s0000626`

### Saskatchewan
- Regina: `SK/s0000788`
- Saskatoon: `SK/s0000797`

### Alberta
- Calgary: `AB/s0000047`
- Edmonton: `AB/s0000045`

## Testing

Run tests with:
```bash
cd functions
npm test
```

Current test coverage:
- ✅ ECCC weather data fetching
- ✅ NASA POWER data fetching
- ✅ Date validation
- ✅ Caching mechanisms (basic functionality)

## Environment Variables

Currently, no environment variables are explicitly required for local emulator startup beyond standard Firebase setup. For production deployment, you will need to ensure your Firebase project is correctly configured, and the Cloud Functions environment has the necessary permissions and configurations (e.g., service account for Admin SDK automatically available in Firebase environment).

## Important Notes

1. **ECCC Weather Stations**: Use province code + station ID (e.g., `MB/s0000193`).
2. **NASA POWER Limitations**: 
   - Potential data lag (typically 2-3 days, verify current status).
   - Resolution approx. 0.5 x 0.5 degree (roughly 50km x 50km).
   - Best for historical/regional analysis, less for real-time field-specific decisions.
3. **Caching**: 
   - ECCC Weather data: 5 minutes (300 seconds) TTL.
   - NASA POWER data: 24 hours (86400 seconds) TTL.
4. **Date Formats**:
   - NASA POWER API requires: `YYYYMMDD` (e.g., `20250529`).
   - API responses generally use ISO 8601 for timestamps.

## Next Steps for Development

1. **Frontend Connection**:
   ```javascript
   // In React app
   const API_BASE = 'http://127.0.0.1:5002/agricast-your-project-id/us-central1'; // Adjust port and project ID
   const weather = await fetch(`${API_BASE}/getWeatherWithInsights?province=MB&station=s0000193`);
   ```

2. **Add Authentication**:
   - Firebase Authentication integration.
   - User profiles for location preferences & alert settings.

3. **Implement Push Notifications & Full Alert System**:
   - Firebase Cloud Messaging (FCM) for push notifications.
   - Background functions to check alert conditions periodically.
   - UI for users to manage their alerts.

4. **Historical Data Storage & Analysis**:
   - Store daily weather snapshots in Firestore for long-term analysis.
   - Build local climate averages and trends.

## Troubleshooting

### Emulator Issues
- Ensure Java Development Kit (JDK) is installed and configured (required for Firestore emulator).
- Check that configured emulator ports (see `firebase.json`) are not in use by other applications.
- Run `firebase emulators:start --debug` for verbose output if issues persist.

### API Errors
- ECCC weather API may occasionally timeout; retry logic is not explicitly implemented in the current service but could be added.
- NASA POWER API may have incomplete data for recent dates; check the `dataCompleteness` field in the response.
- Invalid station codes or parameters will return 4xx errors with details.

### Test Failures
- The `test:mobile` script in `package.json` will fail as no mobile app exists yet. This is expected.
- Ensure emulators are not required for `npm test` (unit tests), but are running for `curl` tests against HTTP endpoints.
- NASA API tests require an active internet connection.

## Contributing

This project is in active development. Key areas for future contributions:
1. Frontend UI/UX implementation (React).
2. Full user authentication and profile management.
3. Mobile application development (e.g., React Native).
4. French language support (i18n).
5. Integration of additional relevant data sources (e.g., soil moisture, commodity prices).
6. Advanced predictive modeling (e.g., machine learning for yield forecasts or pest/disease risk).

## Contact & Support

Project initiated by: Bushels
Repository: https://github.com/Bushels/Agricast

## License

[Specify your chosen open source license, e.g., MIT, Apache 2.0]

---

*Last updated: May 2025*
*Backend implementation includes ECCC weather, NASA satellite data, agricultural calculations, and basic alert framework.*