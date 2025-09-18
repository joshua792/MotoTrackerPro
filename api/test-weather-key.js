module.exports = async function handler(req, res) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    
    console.log('API Key from env:', apiKey);
    
    if (!apiKey) {
      return res.json({ error: 'No API key found in environment variables' });
    }

    // Test with Austin, TX coordinates directly
    const lat = 30.2672;
    const lon = -97.7431;
    
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    console.log('Testing URL:', weatherUrl);
    
    const response = await fetch(weatherUrl);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    res.json({
      success: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: data,
      apiKeyLength: apiKey.length,
      url: weatherUrl.replace(apiKey, 'HIDDEN')
    });
    
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
