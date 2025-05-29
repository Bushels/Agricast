const axios = require('axios');
const xml2js = require('xml2js');

// Base URL for ECCC weather data
const ECCC_BASE = 'https://dd.weather.gc.ca/citypage_weather/xml';

// Base URL for NASA POWER API
const NASA_POWER = 'https://power.larc.nasa.gov/api/temporal/daily/point';

/**
 * Fetches weather data from the ECCC Weather XML API.
 * @param {string} province - The province code (e.g., 'MB').
 * @param {string} cityCode - The city code (e.g., 's0000193').
 * @returns {Promise<object|null>} - A promise resolving with the parsed JSON data or null on error.
 */
async function getECCCWeather(province, cityCode) {
  const url = `${ECCC_BASE}/${province}/${cityCode}_e.xml`;

  try {
    const response = await axios.get(url);
    const xmlData = response.data;

    // Parse XML to JSON
    const parser = new xml2js.Parser({ explicitArray: false });
    const jsonData = await parser.parseStringPromise(xmlData);

    return jsonData;
  } catch (error) {
    console.error(`Error fetching ECCC weather for ${province}/${cityCode}:`, error.message);
    return null;
  }
}

/**
 * Fetches agricultural weather data from the NASA POWER API.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @param {string} startDate - Start date in YYYYMMDD format.
 * @param {string} endDate - End date in YYYYMMDD format.
 * @returns {Promise<object|null>} - A promise resolving with the JSON data or null on error.
 */
async function getNASAPowerData(lat, lon, startDate, endDate) {
  const params = {
    parameters: 'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M', // Example parameters
    community: 'AG',
    longitude: lon,
    latitude: lat,
    start: startDate,
    end: endDate,
    format: 'JSON'
  };

  const url = `${NASA_POWER}?${new URLSearchParams(params)}`;

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching NASA POWER data for ${lat},${lon}:`, error.message);
    return null;
  }
}

module.exports = {
  getECCCWeather,
  getNASAPowerData,
};