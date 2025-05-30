// functions/src/utils/canadianGeography.js

// Base coordinates for the west of each Principal Meridian (approximate)
// These are longitudes. The DLS system is based on these survey lines.
const meridianBases = {
  1: -97.45734,  // Principal Meridian (PM or W1M) - near Winnipeg
  2: -102.0,     // West of the 2nd Meridian (W2M)
  3: -106.0,     // West of the 3rd Meridian (W3M)
  4: -110.0,     // West of the 4th Meridian (W4M) - Alberta/Saskatchewan border
  5: -114.0,     // West of the 5th Meridian (W5M) - Through Calgary
  6: -118.0      // West of the 6th Meridian (W6M) - Into BC
};

// Constants for DLS calculations (approximations)
const MILES_PER_TOWNSHIP = 6; // A township is roughly 6x6 miles
const MILES_PER_RANGE_WIDTH = 6; // Width of a range strip
const MILES_PER_SECTION = 1;   // A section is 1x1 mile

const KM_PER_MILE = 1.60934;
const LAT_DEG_PER_MILE = 1 / 69; // Approx. 69 miles per degree latitude
const LNG_DEG_PER_MILE_AT_49N = 1 / 45.2; // Approx. miles per degree longitude at 49°N (changes with lat)

/**
 * Converts Dominion Land Survey (DLS) location to approximate GPS coordinates.
 * This is a simplified model. Real DLS to GPS is complex due to Earth's curvature
 * and survey inaccuracies.
 * @param {object} dls - DLS object { meridian, township, range, section, quarterSection }
 * @returns {object} { lat, lng } approximate coordinates
 */
async function getDLSCoordinates(dls) {
  const { meridian, township, range, section, quarterSection } = dls;

  if (!meridian || !township || !range) {
    console.warn('Meridian, Township, and Range are required for DLS conversion.');
    return { lat: null, lng: null }; // Or throw error
  }

  // --- Longitude Calculation (Westward from Meridian) ---
  // Base longitude for the given meridian.
  const baseLng = meridianBases[parseInt(meridian, 10)] || meridianBases[1];
  
  // Each range is approx 6 miles wide. Ranges are numbered W of the meridian line.
  // This is a simplification; actual width in degrees longitude decreases as latitude increases.
  // For a rough estimate, we use a fixed offset per range, acknowledging its inaccuracy.
  const lngOffsetFromMeridian = (parseInt(range, 10) - 0.5) * MILES_PER_RANGE_WIDTH * LNG_DEG_PER_MILE_AT_49N; // Center of range strip
  let calculatedLng = baseLng - lngOffsetFromMeridian;

  // --- Latitude Calculation (Northward from US Border/49th Parallel) ---
  const baseLat = 49.0; // DLS townships are numbered north from the 49th parallel (US border).
  
  // Each township is approx 6 miles tall.
  const latOffsetFromBorder = (parseInt(township, 10) - 0.5) * MILES_PER_TOWNSHIP * LAT_DEG_PER_MILE; // Center of township strip
  let calculatedLat = baseLat + latOffsetFromBorder;

  // --- Section and Quarter Section Adjustments (Highly Simplified) ---
  // This part is the most complex in reality due to the serpentine numbering of sections (1-36)
  // and the 1x1 mile nature of sections, then 0.5x0.5 mile quarter sections.
  if (section) {
    const sec = parseInt(section, 10);
    // Very rough adjustment based on section number. A real system uses detailed lookup tables or algorithms.
    // Example: section 1 is SE corner, 36 is NE corner of a township.
    // This naive approach just adds a small offset.
    const sectionRow = Math.floor((sec - 1) / 6); // 0-5
    const sectionCol = (sec - 1) % 6;          // 0-5

    // If serpentine, odd rows (1,3,5 from top) count R-L, even rows (0,2,4 from top) count L-R
    // This is relative to township SE corner being (0,0) for sections for simplicity here.
    const adjCol = (5 - sectionRow) % 2 !== 0 ? sectionCol : 5 - sectionCol; 

    calculatedLat -= (sectionRow * MILES_PER_SECTION * LAT_DEG_PER_MILE);
    calculatedLng += (adjCol * MILES_PER_SECTION * LNG_DEG_PER_MILE_AT_49N);
    
    if (quarterSection) {
      const qsFactor = 0.25 * MILES_PER_SECTION; // Approx center of quarter section from section corner
      if (quarterSection.toUpperCase() === 'NE') {
        calculatedLat += qsFactor * LAT_DEG_PER_MILE;
        calculatedLng += qsFactor * LNG_DEG_PER_MILE_AT_49N;
      } else if (quarterSection.toUpperCase() === 'NW') {
        calculatedLat += qsFactor * LAT_DEG_PER_MILE;
        calculatedLng -= qsFactor * LNG_DEG_PER_MILE_AT_49N;
      } else if (quarterSection.toUpperCase() === 'SE') {
        calculatedLat -= qsFactor * LAT_DEG_PER_MILE;
        calculatedLng += qsFactor * LNG_DEG_PER_MILE_AT_49N;
      } else if (quarterSection.toUpperCase() === 'SW') {
        calculatedLat -= qsFactor * LAT_DEG_PER_MILE;
        calculatedLng -= qsFactor * LNG_DEG_PER_MILE_AT_49N;
      }
    }
  }

  return {
    lat: parseFloat(calculatedLat.toFixed(5)),
    lng: parseFloat(calculatedLng.toFixed(5))
  };
}

/**
 * Reverse lookup: Approximate DLS from GPS coordinates.
 * This is even more approximate than DLS to GPS.
 * @param {object} coordinates - { lat, lng }
 * @returns {object} Approximate DLS data { meridian, township, range, approximate: true }
 */
async function getDLSFromCoordinates(coordinates) {
  const { lat, lng } = coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { error: "Invalid coordinates for DLS lookup" };
  }

  // Determine Meridian (very rough)
  let meridian = 1;
  if (lng < (meridianBases[6] - LNG_DEG_PER_MILE_AT_49N * MILES_PER_RANGE_WIDTH * 15)) meridian = 6; // Approx midpoint for meridian 6 ranges
  else if (lng < (meridianBases[5] - LNG_DEG_PER_MILE_AT_49N * MILES_PER_RANGE_WIDTH * 15)) meridian = 5;
  else if (lng < (meridianBases[4] - LNG_DEG_PER_MILE_AT_49N * MILES_PER_RANGE_WIDTH * 15)) meridian = 4;
  else if (lng < (meridianBases[3] - LNG_DEG_PER_MILE_AT_49N * MILES_PER_RANGE_WIDTH * 15)) meridian = 3;
  else if (lng < (meridianBases[2] - LNG_DEG_PER_MILE_AT_49N * MILES_PER_RANGE_WIDTH * 15)) meridian = 2;

  const baseLngForMeridian = meridianBases[meridian];

  // Calculate Township (north from 49th parallel)
  const township = Math.max(1, Math.floor((lat - 49.0) / (MILES_PER_TOWNSHIP * LAT_DEG_PER_MILE)) + 1);

  // Calculate Range (west from the determined meridian line)
  const range = Math.max(1, Math.floor((baseLngForMeridian - lng) / (MILES_PER_RANGE_WIDTH * LNG_DEG_PER_MILE_AT_49N)) + 1);
  
  // Section and Quarter Section are too complex for this simplified reverse lookup.
  return {
    meridian: meridian,
    township: township,
    range: range,
    section: null, // Not calculated in this simplified version
    quarterSection: null, // Not calculated
    approximate: true
  };
}

/**
 * Placeholder: Get soil zone from coordinates.
 * In production, this would query a GIS service or a detailed soil map dataset.
 */
async function getSoilZone(coordinates) {
  const { lat, lng } = coordinates;
  if (typeof lat !== 'number') return 'Unknown';
  
  // Highly simplified based on latitude for Canadian Prairies.
  if (lat > 53.5) return 'Grey';
  if (lat > 52) return 'Black';
  if (lat > 50.5) return 'Dark Brown';
  if (lat > 49) return 'Brown';
  return 'Other'; // For areas outside typical prairie Ag soil zones by this simple logic
}

/**
 * Placeholder: Get climate region from coordinates.
 * In production, this would involve a more detailed lookup.
 */
async function getClimateRegion(coordinates) {
  // This is a very coarse placeholder.
  const { lat } = coordinates;
  if (typeof lat !== 'number') return 'Unknown';

  if (lat > 52) return 'Northern Prairie';
  if (lat > 49) return 'Central Prairie';
  return 'Southern Agricultural';
}

// Placeholder for finding nearest weather station - this would typically involve
// a database of stations and geospatial querying.
async function findNearestWeatherStation(coordinates) {
    console.warn('findNearestWeatherStation is a placeholder. Returning dummy data.');
    return {
        id: 'S0000STUB',
        name: 'Stubville Ag Station',
        distance: Math.round(Math.random() * 50) + 5, // Random distance 5-55km
        lat: coordinates.lat + (Math.random() - 0.5) * 0.1, // Slightly offset from input
        lng: coordinates.lng + (Math.random() - 0.5) * 0.1
    };
}

// Placeholder for reverse geocoding - uses a mock response
async function reverseGeocode(coordinates) {
    console.warn('reverseGeocode is a placeholder. Returning dummy data.');
    return {
        province: 'SK', // Saskatchewan default
        county: 'RM of Placeholder County',
        nearestTown: 'Faketown',
        fullAddress: 'Near Faketown, SK, Canada'
    };
}


module.exports = {
  getDLSCoordinates,
  getDLSFromCoordinates,
  getSoilZone,
  getClimateRegion,
  // Exposing these stubs as they are used by authService.js for now
  findNearestWeatherStation,
  reverseGeocode
};
