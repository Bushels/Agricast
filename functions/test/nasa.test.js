const nasaService = require('../src/services/nasa');

describe('NASA POWER Service', () => {
  // Increase timeout for tests that call external APIs
  jest.setTimeout(30000); // 30 seconds

  test('fetchNASAPowerData returns precipitation data for Winnipeg area', async () => {
    // Test with Winnipeg coordinates for last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7); // Corrected: setDate based on endDate
    
    // Format dates as YYYYMMDD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    const data = await nasaService.fetchNASAPowerData(
      49.8954,  // Winnipeg latitude
      -97.1385, // Winnipeg longitude
      formatDate(startDate),
      formatDate(endDate)
    );
    
    // Basic structure checks
    expect(data).toBeDefined();
    expect(data).toHaveProperty('location');
    expect(data.location).toHaveProperty('latitude', 49.8954);
    expect(data.location).toHaveProperty('longitude', -97.1385);
    expect(data).toHaveProperty('period');
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('totalPrecipitation');
    expect(data.summary).toHaveProperty('averageDaily');
    expect(data.summary).toHaveProperty('unit', 'mm');
    expect(data).toHaveProperty('daily');
    expect(Array.isArray(data.daily)).toBe(true);
    
    // Check that we got data for the requested period (should be around 8 days: 7 past days + today)
    expect(data.daily.length).toBeGreaterThanOrEqual(7); // Depending on exact timing, could be 7 or 8
    expect(data.daily.length).toBeLessThanOrEqual(8);

    // Check structure of a daily entry if data exists
    if (data.daily.length > 0 && data.daily[0].precipitation !== null) {
      const firstDay = data.daily[0];
      expect(firstDay).toHaveProperty('date');
      expect(firstDay).toHaveProperty('precipitation');
      expect(firstDay).toHaveProperty('unit', 'mm');
      expect(typeof firstDay.date).toBe('string');
      // Precipitation can be a number or null
      if (firstDay.precipitation !== null) {
         expect(typeof firstDay.precipitation).toBe('number');
      }
    }
    
    console.log('NASA POWER test passed for Winnipeg!');
    console.log(`Total precipitation (Winnipeg, last 7 days): ${data.summary.totalPrecipitation}mm`);
    console.log(`Data completeness: ${data.summary.dataCompleteness}`);
  });

  test('isValidDate validates YYYYMMDD format correctly', () => {
    expect(nasaService.isValidDate('20240529')).toBe(true);
    expect(nasaService.isValidDate('20230228')).toBe(true);
    expect(nasaService.isValidDate('20230229')).toBe(false); // Not a leap year
    expect(nasaService.isValidDate('20240229')).toBe(true);  // Leap year
    expect(nasaService.isValidDate('20241301')).toBe(false); // Invalid month
    expect(nasaService.isValidDate('20241232')).toBe(false); // Invalid day
    expect(nasaService.isValidDate('2024529')).toBe(false);  // Too short
    expect(nasaService.isValidDate('202400529')).toBe(false); // Too long
    expect(nasaService.isValidDate('abcdefgh')).toBe(false);
    expect(nasaService.isValidDate('2024-05-29')).toBe(false); // Invalid characters
  });
});
