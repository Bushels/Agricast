const weatherService = require('../src/services/weather'); // Adjust path as needed

// Mock Firebase Admin SDK if needed for caching functions, though
// for this simple test of fetchECCCWeather, it might not be necessary
// unless you integrate caching directly into fetchECCCWeather.
// If caching is in separate functions, you can mock those or omit mocking admin.

describe('WeatherService', () => {
  test('fetchECCCWeather returns data for Winnipeg', async () => {
    // Test with Winnipeg (MB/s0000193)
    const data = await weatherService.fetchECCCWeather('MB', 's0000193');
    
    // Check that we got the expected structure
    expect(data).not.toBeNull(); // Ensure data is not null or undefined
    expect(data).toHaveProperty('location');
    expect(data.location).toHaveProperty('city', 'Winnipeg'); // More specific assertion
    expect(data).toHaveProperty('current');
    expect(data.current).toHaveProperty('temperature'); // Checks for existence of temperature
    expect(data).toHaveProperty('forecast');
    expect(Array.isArray(data.forecast)).toBe(true);
    
    console.log('Current temperature in Winnipeg:', data.current.temperature + '°C');
  });
});