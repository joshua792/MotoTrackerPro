// Minimal debug webhook to isolate the 400 error issue

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  console.log('=== DEBUG WEBHOOK START ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  try {
    const rawBody = await getRawBody(req);
    console.log('Body length:', rawBody.length);
    console.log('Body preview:', rawBody.toString('utf8', 0, 100));

    const event = JSON.parse(rawBody.toString('utf8'));
    console.log('Event type:', event.type);
    console.log('Event ID:', event.id);

    console.log('=== DEBUG WEBHOOK SUCCESS ===');
    res.status(200).json({
      success: true,
      received: event.type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== DEBUG WEBHOOK ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};