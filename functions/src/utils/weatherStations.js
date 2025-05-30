// functions/src/utils/weatherStations.js

const PRAIRIE_STATIONS = [
  // Manitoba
  { id: 's0000193', name: 'Winnipeg The Forks', province: 'MB', lat: 49.8888, lng: -97.1264 }, 
  { id: 's0000492', name: 'Brandon AAFC', province: 'MB', lat: 49.8667, lng: -99.9833 }, 
  { id: 's0000626', name: 'Portage la Prairie', province: 'MB', lat: 49.9728, lng: -98.2919 },
  { id: 's0000720', name: 'Dauphin A', province: 'MB', lat: 51.1008, lng: -100.0519 },
  { id: 's0000380', name: 'Morden CS', province: 'MB', lat: 49.1911, lng: -98.0872 },

  // Saskatchewan  
  { id: 's0000788', name: "Regina Int'l A", province: 'SK', lat: 50.4319, lng: -104.6658 },
  { id: 's0000797', name: "Saskatoon Diefenbaker Int'l A", province: 'SK', lat: 52.1708, lng: -106.6997 }, // Fixed apostrophe
  { id: 's0000832', name: 'Swift Current A', province: 'SK', lat: 50.2919, lng: -107.6900 },
  { id: 's0000613', name: 'Moose Jaw A', province: 'SK', lat: 50.3303, lng: -105.5581 },
  { id: 's0000661', name: 'Yorkton A', province: 'SK', lat: 51.2656, lng: -102.4614 },
  { id: 's0000141', name: 'North Battleford A', province: 'SK', lat: 52.7761, lng: -108.2522 },
  { id: 's0000161', name: 'Prince Albert A', province: 'SK', lat: 53.2147, lng: -105.6725 },

  // Alberta
  { id: 's0000047', name: "Calgary Int'l A", province: 'AB', lat: 51.1208, lng: -114.0106 },
  { id: 's0000045', name: "Edmonton Int'l A", province: 'AB', lat: 53.3094, lng: -113.5797 }, 
  { id: 's0000286', name: "Edmonton City Centre A", province: 'AB', lat: 53.5722, lng: -113.5189 }, 
  { id: 's0000030', name: 'Lethbridge A', province: 'AB', lat: 49.6300, lng: -112.7992 },
  { id: 's0000448', name: 'Medicine Hat A', province: 'AB', lat: 50.0186, lng: -110.7200 },
  { id: 's0000004', name: 'Red Deer Regional A', province: 'AB', lat: 52.1819, lng: -113.8939 },
  { id: 's0000013', name: 'Grande Prairie A', province: 'AB', lat: 55.1797, lng: -118.8850 }
];

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371; 
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(radLat1) * Math.cos(radLat2) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

async function findNearestWeatherStation(coordinates) {
  if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
    console.warn('Invalid coordinates provided to findNearestWeatherStation:', coordinates);
    return null;
  }
  const { lat, lng } = coordinates;
  let nearestStation = null;
  let minDistance = Infinity;
  PRAIRIE_STATIONS.forEach(station => {
    const distance = calculateDistance(lat, lng, station.lat, station.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestStation = {
        id: station.id,
        name: station.name,
        province: station.province,
        distance: parseFloat(minDistance.toFixed(1))
      };
    }
  });
  if (nearestStation) {
    console.log(`Nearest station to ${lat},${lng} is ${nearestStation.name} (${nearestStation.id}) at ${nearestStation.distance} km.`);
  }
  return nearestStation;
}

module.exports = {
  findNearestWeatherStation,
  calculateDistance,
  PRAIRIE_STATIONS 
};
