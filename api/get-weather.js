const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track, location, units } = req.query;
  
  // Accept either 'track' or 'location' parameter and decode if needed
  const searchLocation = decodeURIComponent(track || location || '');
  const temperatureUnit = units || 'celsius'; // Default to celsius

  if (!searchLocation) {
    return res.status(400).json({ error: 'Track or location parameter is required' });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenWeather API key not configured' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    let lat, lon;
    let coordResult = null;

    // First try to find coordinates from previous sessions at this track
    try {
      const coordQuery = `
        SELECT DISTINCT s.latitude, s.longitude 
        FROM sessions s
        JOIN events e ON s.event_id = e.id
        WHERE LOWER(e.track) = LOWER($1) 
        AND s.latitude IS NOT NULL 
        AND s.longitude IS NOT NULL 
        LIMIT 1
      `;
      
      coordResult = await pool.query(coordQuery, [searchLocation]);
      
      if (coordResult.rows.length > 0) {
        lat = coordResult.rows[0].latitude;
        lon = coordResult.rows[0].longitude;
        console.log(`Found coordinates in database for ${searchLocation}: ${lat}, ${lon}`);
      }
    } catch (dbError) {
      console.log('Database coordinate lookup failed:', dbError.message);
    }

    // If no coordinates found in database, use geocoding
    if (!lat || !lon) {
      console.log(`Using geocoding for: ${searchLocation}`);
      
      // Try multiple search variations for better geocoding results
      const searchVariations = [
        searchLocation,
        searchLocation.replace(',', ''), // "Austin TX"
        searchLocation.split(',')[0], // "Austin"
        `${searchLocation}, USA`, // "Austin, TX, USA"
        searchLocation.replace(/,\s*TX/i, ', Texas') // "Austin, Texas"
      ];
      
      let geocodeData = null;
      
      for (const variation of searchVariations) {
        const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(variation)}&limit=1&appid=${apiKey}`;
        console.log('Trying geocoding with:', variation);
        
        const geocodeResponse = await fetch(geocodeUrl);
        console.log('Geocoding status:', geocodeResponse.status);
        
        if (geocodeResponse.ok) {
          const data = await geocodeResponse.json();
          console.log('Geocoding data for', variation, ':', data);
          
          if (data && data.length > 0) {
            geocodeData = data;
            console.log('Found coordinates with variation:', variation);
            break;
          }
        }
      }

      if (!geocodeData || geocodeData.length === 0) {
        await pool.end();
        return res.status(404).json({ 
          error: `Location '${searchLocation}' not found`,
          tried: searchVariations,
          suggestion: 'Try "Austin, Texas" or just "Austin"'
        });
      }

      lat = geocodeData[0].lat;
      lon = geocodeData[0].lon;
      console.log('Coordinates from geocoding:', lat, lon);
    }

    // Get current weather (always use metric, convert in frontend)
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    console.log('Weather URL:', weatherUrl.replace(apiKey, 'HIDDEN'));
    
    const weatherResponse = await fetch(weatherUrl);
    console.log('Weather response status:', weatherResponse.status);
    
    if (!weatherResponse.ok) {
      const weatherError = await weatherResponse.text();
      console.log('Weather error:', weatherError);
      await pool.end();
      throw new Error(`Weather API failed: ${weatherResponse.status} ${weatherResponse.statusText}`);
    }
    
    const weatherData = await weatherResponse.json();
    console.log('Weather data received:', weatherData);

    // Get temperature in Celsius from API
    const tempCelsius = weatherData.main?.temp || 0;
    const tempFahrenheit = (tempCelsius * 9/5) + 32;

    const weather = {
      temperature: temperatureUnit === 'fahrenheit' ? Math.round(tempFahrenheit) : Math.round(tempCelsius),
      temperatureCelsius: Math.round(tempCelsius),
      temperatureFahrenheit: Math.round(tempFahrenheit),
      humidity: weatherData.main?.humidity || 0,
      pressure: Math.round(weatherData.main?.pressure || 0),
      windSpeed: Math.round((weatherData.wind?.speed || 0) * 3.6), // Convert m/s to km/h
      windDirection: weatherData.wind?.deg || 0,
      conditions: weatherData.weather?.[0]?.description || 'Unknown',
      cloudCover: weatherData.clouds?.all || 0,
      latitude: lat,
      longitude: lon,
      unit: temperatureUnit
    };

    await pool.end();

    console.log('Final weather object:', weather);

    res.json({
      success: true,
      weather,
      location: searchLocation,
      source: coordResult?.rows?.length > 0 ? 'database' : 'geocoding'
    });

  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weather data',
      details: error.message,
      location: searchLocation
    });
  }
};
