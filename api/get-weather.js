const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track, location } = req.query;
  
  // Accept either 'track' or 'location' parameter and decode if needed
  const searchLocation = decodeURIComponent(track || location || '');

  if (!searchLocation) {
    return res.status(400).json({ error: 'Track or location parameter is required' });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenWeather API key not configured' });
    }

    console.log('Getting weather for location:', searchLocation);
    
    // Use geocoding to find coordinates
    const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchLocation)}&limit=1&appid=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    
    if (!geocodeResponse.ok) {
      throw new Error(`Geocoding failed: ${geocodeResponse.status} ${geocodeResponse.statusText}`);
    }
    
    const geocodeData = await geocodeResponse.json();

    if (!geocodeData || geocodeData.length === 0) {
      return res.status(404).json({ error: `Location '${searchLocation}' not found` });
    }

    const lat = geocodeData[0].lat;
    const lon = geocodeData[0].lon;

    // Get current weather
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      throw new Error(weatherData.message || 'Failed to fetch weather data');
    }

    const weather = {
      temperature: Math.round(weatherData.main.temp),
      humidity: weatherData.main.humidity,
      pressure: Math.round(weatherData.main.pressure),
      windSpeed: Math.round(weatherData.wind?.speed * 3.6 || 0), // Convert m/s to km/h
      windDirection: weatherData.wind?.deg || 0,
      conditions: weatherData.weather[0]?.description || 'Unknown',
      cloudCover: weatherData.clouds?.all || 0,
      latitude: lat,
      longitude: lon
    };

    res.json({
      success: true,
      weather,
      location: searchLocation
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
