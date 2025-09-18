export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lon, location } = req.query;

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    let weatherUrl;
    if (lat && lon) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    } else if (location) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`;
    } else {
      return res.status(400).json({ error: 'Location or coordinates required' });
    }

    const response = await fetch(weatherUrl);
    const weatherData = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: 'Weather data not found' });
    }

    const weather = {
      temperature: Math.round(weatherData.main.temp),
      condition: weatherData.weather[0].main,
      description: weatherData.weather[0].description,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind?.speed || 0,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({ weather });
  } catch (error) {
    console.error('Weather API error:', error);
    return res.status(500).json({ error: 'Weather service unavailable' });
  }
}
