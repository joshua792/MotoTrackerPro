import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Create events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        track VARCHAR(200) NOT NULL,
        date DATE NOT NULL,
        location VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tires table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tires (
        id VARCHAR(255) PRIMARY KEY,
        brand VARCHAR(100) NOT NULL,
        type VARCHAR(100) NOT NULL,
        size VARCHAR(100) NOT NULL,
        compound VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default events
    const defaultEvents = [
      { id: 'daytona-mar7', name: 'Daytona 200', track: 'Daytona International Speedway', date: '2025-03-07', location: 'Daytona Beach, FL' },
      { id: 'cota-mar28', name: 'Talent Cup at MotoGP', track: 'Circuit of the Americas', date: '2025-03-28', location: 'Austin, TX' },
      { id: 'barber-apr4', name: 'MotoAmerica Superbikes at Barber', track: 'Barber Motorsports Park', date: '2025-04-04', location: 'Birmingham, AL' },
      { id: 'roadatlanta-may2', name: 'MotoAmerica at Road Atlanta', track: 'Road Atlanta', date: '2025-05-02', location: 'Braselton, GA' },
      { id: 'roadamerica-may30', name: 'MotoAmerica at Road America', track: 'Road America', date: '2025-05-30', location: 'Elkhart Lake, WI' },
      { id: 'ridge-jun28', name: 'MotoAmerica at The Ridge', track: 'The Ridge Motorsports Park', date: '2025-06-28', location: 'Shelton, WA' },
      { id: 'laguna-jul12', name: 'MotoAmerica at Laguna Seca', track: 'WeatherTech Raceway Laguna Seca', date: '2025-07-12', location: 'Monterey, CA' },
      { id: 'midohio-jul25', name: 'MotoAmerica at Mid-Ohio', track: 'Mid-Ohio Sports Car Course', date: '2025-07-25', location: 'Lexington, OH' },
      { id: 'vir-aug1', name: 'MotoAmerica at VIR', track: 'Virginia International Raceway', date: '2025-08-01', location: 'Danville, VA' },
      { id: 'midohio2-aug15', name: 'MotoAmerica at Mid-Ohio 2', track: 'Mid-Ohio Sports Car Course', date: '2025-08-15', location: 'Lexington, OH' },
      { id: 'cota2-sep12', name: 'MotoAmerica at COTA', track: 'Circuit of the Americas', date: '2025-09-12', location: 'Austin, TX' },
      { id: 'njmp-sep26', name: 'MotoAmerica at NJMP', track: 'New Jersey Motorsports Park', date: '2025-09-26', location: 'Millville, NJ' }
    ];

    // Insert default tires
    const defaultTires = [
      { id: 'dunlop-slick-120-200', brand: 'Dunlop', type: 'Slick', size: '120/70-17 & 200/55-17', compound: 'Medium' },
      { id: 'dunlop-slick-120-190', brand: 'Dunlop', type: 'Slick', size: '120/70-17 & 190/55-17', compound: 'Medium' },
      { id: 'dunlop-wet-120-200', brand: 'Dunlop', type: 'Wet', size: '120/70-17 & 200/55-17', compound: 'Intermediate' },
      { id: 'dunlop-wet-120-190', brand: 'Dunlop', type: 'Wet', size: '120/70-17 & 190/55-17', compound: 'Intermediate' }
    ];

    for (const event of defaultEvents) {
      await client.query(
        'INSERT INTO events (id, name, track, date, location) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [event.id, event.name, event.track, event.date, event.location]
      );
    }

    for (const tire of defaultTires) {
      await client.query(
        'INSERT INTO tires (id, brand, type, size, compound) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [tire.id, tire.brand, tire.type, tire.size, tire.compound]
      );
    }

    await client.end();
    return res.status(200).json({ success: true, message: 'Tables created and populated' });

  } catch (error) {
    console.error('Database error:', error);
    try { await client.end(); } catch {}
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
