// Simple test endpoint to verify webhook connectivity

module.exports = async function handler(req, res) {
  console.log('=== WEBHOOK TEST CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body);

  res.json({
    success: true,
    message: 'Webhook test endpoint reached successfully',
    timestamp: new Date().toISOString(),
    method: req.method
  });
};