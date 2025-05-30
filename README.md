# Agricast - Agricultural Weather Intelligence Platform

## Project Overview

Agricast is a comprehensive agricultural weather intelligence platform designed to provide Canadian farmers with real-time weather data, calculated agricultural metrics, and actionable insights for farming operations. The platform integrates multiple data sources including Environment and Climate Change Canada (ECCC) weather stations and NASA POWER satellite data, while building a community-driven ecosystem where farmers contribute local observations and earn rewards through gamification.

## Vision

To create a farmer-first platform that combines hyperlocal weather intelligence with community insights, helping Canadian farmers make data-driven decisions while building the most accurate agricultural weather network through crowdsourced observations.

## Key Features

### Core Weather Intelligence
- **Real-time Weather Data**: Integration with Environment Canada weather stations
- **7-Day Forecasts**: Detailed hourly breakdowns with precipitation amounts
- **Satellite Data**: NASA POWER integration for historical precipitation analysis
- **Agricultural Calculations**: 
  - Growing Degree Days (GDD) with crop-specific base temperatures
  - Corn Heat Units (CHU)
  - Spray condition assessments (wind, temperature, humidity)
  - Drying conditions scoring
  - Frost risk analysis
  - Evapotranspiration calculations (planned)
  - Disease pressure indices (planned)

### Farmer Engagement & Community
- **User Authentication**: Support for Apple ID, Google, and email/password login
- **Farmer Profiles**: Customizable profiles with farm name and location
- **Canadian-Specific Features**: 
  - Dominion Land Survey (DLS) location input for Western Canada
  - Support for all major Canadian crops including specialized varieties
- **Gamification System**:
  - Points for weather reports, rainfall measurements, and community contributions
  - Achievement badges and farmer levels
  - Daily contribution streaks
  - Community leaderboards
  - Future rewards from agricultural partners

### Data Management
- **Crop Tracking**: Annual crop rotation management with historical archiving
- **Multi-User Farms**: Support for multiple users per farm operation
- **Smart Caching**: Optimized data fetching with appropriate TTLs
- **Offline Support**: Progressive Web App capabilities (planned)

## Current Implementation Status

### ✅ Completed Features

#### Backend Infrastructure
1. **Weather Data Integration**
   - ECCC weather station integration with 5-minute caching
   - NASA POWER satellite data with 24-hour caching
   - Support for multiple weather stations
   - Precipitation amount extraction from forecasts

2. **Agricultural Calculations Service**
   - Complete GDD and CHU calculations
   - Spray condition assessment algorithm
   - Drying conditions scoring system
   - Frost risk analysis
   - Weather data enrichment with agricultural insights

3. **Authentication & User Management**
   - Firebase Authentication with multiple providers (Apple, Google, Email)
   - Custom username-based login system
   - Comprehensive farmer profile structure
   - Profile creation flow with validation
   - Admin capabilities for user management

4. **Data Architecture**
   - Firestore database design with security rules
   - Username uniqueness enforcement
   - Crop history archiving system
   - Activity logging for audit trails
   - Seasonal prompt system for crop updates

5. **Cloud Functions**
   - User registration and profile management
   - Crop data updates with yearly archiving
   - Admin functions (user deletion, role management)
   - Scheduled functions for seasonal prompts
   - Cleanup triggers for data consistency

6. **Security & Permissions**
   - Role-based access control (farmers, admins)
   - Row-level security in Firestore
   - API authentication middleware
   - Custom claims for authorization

#### Frontend Design
1. **UI/UX Prototype**
   - Complete authentication flow design
   - Mobile-first responsive layouts
   - Agricultural color scheme and branding
   - Accessibility considerations
   - Offline-first design principles

2. **User Experience Flow**
   - Streamlined 4-step registration
   - Location selection (map pin or DLS)
   - Crop management interface
   - Progress indicators and validations
   - Instant gratification features

### 🚧 In Progress

1. **Frontend Implementation**
   - React Native mobile app components
   - React web application
   - Integration with backend services
   - Real-time data synchronization

2. **Enhanced Calculations**
   - Evapotranspiration (ET) calculations
   - Disease pressure modeling
   - Soil temperature predictions
   - Harvest window optimization

### 📋 Planned Features

#### Short Term (Next Sprint)
1. **Dashboard Development**
   - Real-time weather display
   - Interactive crop progress charts
   - Community activity feed
   - Quick action buttons for reports

2. **Gamification Implementation**
   - Point calculation engine
   - Badge award system
   - Leaderboard generation
   - Streak tracking
   - Achievement notifications

3. **Community Features**
   - Weather report submissions
   - Rainfall measurements with verification
   - Helpful vote system
   - Nearby farmer updates
   - First frost/rain reporting

#### Medium Term
1. **Advanced Analytics**
   - Historical weather comparisons
   - Yield correlation analysis
   - Cost savings tracking
   - Predictive insights

2. **Push Notifications**
   - Weather alerts
   - Frost warnings
   - Optimal spray windows
   - Community updates
   - Gamification milestones

3. **Partner Integrations**
   - Reward redemption system
   - Equipment dealer connections
   - Crop insurance integrations
   - Market price feeds

#### Long Term
1. **Precision Agriculture**
   - Field boundary mapping
   - Variable rate recommendations
   - IoT sensor integration
   - Drone imagery analysis

2. **Machine Learning**
   - Hyperlocal forecast improvements
   - Yield prediction models
   - Pest/disease outbreak predictions
   - Personalized recommendations

3. **Expansion**
   - Multi-language support (French)
   - Coverage beyond Canadian prairies
   - International market adaptation
   - Agricultural consultant tools

## Tech Stack

### Backend
- **Runtime**: Node.js 18+ with Firebase Cloud Functions
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **APIs**: 
  - Environment Canada XML Weather API
  - NASA POWER REST API
- **Development**: Firebase Emulators

### Frontend (Planned)
- **Mobile**: React Native
- **Web**: React
- **State Management**: Context API / Redux
- **Maps**: Mapbox GL
- **Charts**: Chart.js / D3.js

### Infrastructure
- **Hosting**: Firebase Hosting
- **Functions**: Firebase Cloud Functions
- **Storage**: Firebase Storage (future)
- **Analytics**: Firebase Analytics

## Project Structure

```
agricast/
├── functions/
│   ├── src/
│   │   ├── index.js              # Cloud Functions entry points
│   │   ├── config/               # Configuration files
│   │   │   └── auth.js          # Auth configuration
│   │   ├── services/
│   │   │   ├── weather.js       # ECCC weather integration
│   │   │   ├── nasa.js          # NASA POWER integration
│   │   │   ├── calculations.js  # Agricultural calculations
│   │   │   ├── alerts.js        # Alert system (framework)
│   │   │   └── auth/
│   │   │       ├── authService.js      # User registration
│   │   │       └── usernameService.js  # Username validation
│   │   │   └── crops/
│   │   │       └── cropService.js      # Crop management
│   │   │   └── admin/
│   │   │       └── adminService.js     # Admin functions
│   │   └── utils/
│   │       ├── validation.js          # Input validation
│   │       ├── canadianGeography.js   # DLS conversions
│   │       ├── weatherStations.js     # Station lookup
│   │       └── helpers.js             # Utility functions
│   ├── test/
│   │   ├── unit/                      # Unit tests
│   │   ├── integration/               # Integration tests
│   │   └── test-local/               # Local test scripts
│   └── package.json
├── mobile/                       # React Native app (to be implemented)
├── web/                         # React web app (to be implemented)
├── firebase.json                # Firebase configuration
├── firestore.rules             # Security rules
├── firestore.indexes.json      # Database indexes
└── .firebaserc                 # Project aliases
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm installed
- Firebase CLI (`npm install -g firebase-tools`)
- Git configured
- Firebase project created

### Installation

```bash
# Clone the repository
git clone https://github.com/[your-username]/agricast.git
cd agricast

# Install Cloud Functions dependencies
cd functions
npm install

# Return to root
cd ..
```

### Configuration

1. **Update Firebase Project ID**:
   ```bash
   # Edit .firebaserc and replace with your project ID
   firebase use your-project-id
   ```

2. **Set up Firebase services**:
   - Enable Authentication (Email, Google, Apple providers)
   - Enable Firestore Database
   - Enable Cloud Functions

3. **Configure Mapbox** (for frontend):
   ```bash
   # Add to your .env file
   REACT_APP_MAPBOX_TOKEN=your_mapbox_token
   ```

### Running Locally

```bash
# Start Firebase emulators
firebase emulators:start

# In another terminal, run tests
cd functions
npm test
```

### Deployment

```bash
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

## API Documentation

### Cloud Functions (Callable)

#### Authentication
- `createFarmerProfile` - Creates farmer profile after authentication
- `checkUsernameAvailability` - Validates username uniqueness

#### Crop Management
- `updateCropData` - Updates current season crops with archiving
- `getCropHistory` - Retrieves historical crop data

#### Admin Functions
- `adminDeleteUser` - Removes user and all associated data
- `setAdminRole` - Grants/revokes admin privileges

### REST Endpoints

#### Weather Data
- `GET /getWeather?province=MB&station=s0000193`
- `GET /getWeatherWithInsights?province=MB&station=s0000193`
- `GET /getNASAPowerData?lat=49.8954&lon=-97.1385&startDate=YYYYMMDD&endDate=YYYYMMDD`

## Testing

### Unit Tests
```bash
cd functions
npm test
```

### Integration Tests
Requires Firebase emulators running:
```bash
firebase emulators:start
# In another terminal
cd functions
npm run test:integration
```

### Manual Testing
Use the provided test HTML files in `functions/test-local/` for manual testing of authentication flows and API endpoints.

## Contributing

### Development Workflow
1. Create feature branch from `main`
2. Implement feature with tests
3. Ensure all tests pass
4. Submit pull request with description

### Code Standards
- ESLint configuration in `functions/.eslintrc.js`
- Prettier for code formatting
- JSDoc comments for all functions
- Comprehensive error handling

### Priority Areas for Contribution
1. Frontend implementation (React/React Native)
2. Enhanced agricultural calculations
3. Community features
4. French language support
5. Additional weather data sources
6. Mobile offline capabilities

## License

[To be determined - likely MIT or Apache 2.0]

## Contact

Project Lead: [Your name/contact]
Repository: https://github.com/[your-username]/agricast

---

*Last updated: May 2025*
*Version: 0.5.0 (Beta Development)*
