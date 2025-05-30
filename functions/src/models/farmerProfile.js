// functions/src/models/farmerProfile.js

/**
 * Farmer profile schema optimized for Canadian agriculture.
 * Supports both DLS (Dominion Land Survey) and GPS coordinates,
 * and includes gamification elements.
 */
const FarmerProfileSchema = {
  // Authentication & Identity
  uid: '',                    // Firebase UID, primary key
  email: '',                  // User's email address
  username: '',               // Unique, lowercase username for login and display
  
  // Farm Identity
  farmName: '',              // Optional farm business name
  displayFarmName: false,    // Boolean: Whether to show farm name publicly
  
  // Location (Canadian-specific focus)
  location: {
    method: 'pin',           // 'dls' (Dominion Land Survey) or 'pin' (Mapbox click)
    
    // For DLS (Dominion Land Survey) - Primarily Western Canada
    dls: {
      meridian: null,        // Integer: 1-6 (Prime, W2M, W3M, etc.)
      township: null,        // Integer: 1-126
      range: null,           // Integer: 1-34
      section: null,         // Integer: 1-36
      quarterSection: '',    // String: 'NE', 'NW', 'SE', 'SW'
      lsd: null             // Integer: Legal Subdivision 1-16 (optional)
    },
    
    // For GPS coordinates (from Mapbox or manual entry)
    coordinates: {
      lat: null,             // Number: Latitude
      lng: null              // Number: Longitude
    },
    
    // Derived location data (auto-populated by backend services)
    derived: {
      province: '',          // String: Auto-detected Canadian province (e.g., 'SK')
      county: '',            // String: Rural municipality or county
      nearestTown: '',
      soilZone: '',         // String: Agricultural soil zone (e.g., 'Brown', 'Dark Brown')
      climateRegion: '',    // String: Crop insurance or climate classification region
      nearestStation: {     // Details of the closest ECCC weather station
        id: '',             // Station ID (e.g., 's0000797')
        name: '',           // Station Name
        distance: 0        // Kilometers to station
      }
    }
  },
  
  // Farm Operations Details
  farmDetails: {
    totalAcres: 0,           // Number: Total farm size in acres
    ownedAcres: 0,           // Number: Acres owned
    rentedAcres: 0,          // Number: Acres rented/leased
    
    // Crop information - array of crop objects
    crops: [
      /* Example structure for an item in the crops array:
      {
        type: 'wheat',        // String:Lowercase, e.g., 'wheat', 'canola', 'barley', 'corn', 'soybeans'
        variety: 'AAC Brandon', // String: Optional specific variety
        acres: 500,           // Number: Acres planted for this crop
        fields: [],           // Array: Future use for linking to specific field polygons
        plantingDate: null,   // Date: ISOString or Firestore Timestamp
        expectedHarvest: null // Date: ISOString or Firestore Timestamp
      } 
      */
    ],
    
    // Additional farm characteristics
    hasLivestock: false,     // Boolean
    hasIrrigation: false,    // Boolean
    usesPrecisionAg: false   // Boolean
  },
  
  // Gamification Profile
  gamification: {
    points: 100,              // Integer: Starting bonus, accumulates with actions
    level: 1,                 // Integer: Calculated from points
    title: 'Seedling Farmer', // String: Rank title based on level
    
    // Streaks for consistent engagement
    streak: {
      current: 0,             // Integer: Current daily contribution streak
      longest: 0,             // Integer: Longest streak achieved
      lastContribution: null  // Firestore Timestamp: Last date of a qualifying contribution
    },
    
    // Badges earned by the user
    badges: [],               // Array of strings (badge IDs, e.g., ['early_adopter', 'first_report'])
    hiddenBadges: [],         // Array of strings for surprise/easter-egg badges
    
    // Contribution tracking for specific actions
    contributions: {
      weatherReports: 0,        // Integer: Count of general weather reports submitted
      rainfallMeasurements: 0,  // Integer: Count of rainfall data points
      frostReports: 0,          // Integer: Count of frost reports
      fieldConditions: 0,       // Integer: Count of field condition updates
      helpfulVotes: 0           // Integer: Votes received on their contributions
    },
    
    // Progress towards defined achievements
    achievementProgress: {
      earlyRiser: 0,         // Integer: Days reported before 6 AM local time
      rainGaugeHero: 0,      // Integer: Number of rainfall reports with specific amounts
      frostSentinel: 0,      // Integer: Number of first/last frost reports for a season
      communityHelper: 0     // Integer: Number of helpful votes received on their reports
    }
  },
  
  // User Preferences
  preferences: {
    units: 'metric',          // String: 'metric' or 'imperial'
    notifications: {
      weatherAlerts: true,    // Boolean: General weather alerts
      communityUpdates: true, // Boolean: Updates from community features
      gamificationAlerts: true,// Boolean: Notifications about points, badges, levels
      severeWeather: true    // Boolean: Specific alerts for severe weather warnings
    },
    privacy: {
      showUsername: true,            // Boolean: Display username publicly vs. anonymous
      showLocation: 'county',      // String: 'hidden', 'county', 'precise' (for community sharing)
      shareDataAnonymously: true   // Boolean: Allow anonymized data for broader insights
    }
  },
  
  // System Metadata
  metadata: {
    createdAt: null,          // Firestore Timestamp: Profile creation date
    lastActive: null,         // Firestore Timestamp: Last user activity
    appVersion: '',           // String: App version at last login/activity
    platform: '',             // String: 'ios', 'android', 'web'
    referralSource: '',       // String: How they heard about the app (e.g., 'friend', 'ad', 'store')
    authProvider: '',         // String: e.g., 'password', 'google.com', 'apple.com'
    isBetaTester: false,      // Boolean: Flag if user is part of beta program
    isAlphaTester: false      // Boolean: Flag if user is part of alpha program
  }
};

module.exports = { FarmerProfileSchema };
