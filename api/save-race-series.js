const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Check if user is admin
    const userQuery = 'SELECT is_admin FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    if (!userResult.rows[0].is_admin) {
      await pool.end();
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id, name, description, website, is_active } = req.body;

    if (!name || name.trim().length === 0) {
      await pool.end();
      return res.status(400).json({ error: 'Race series name is required' });
    }

    let result;

    if (id) {
      // Update existing race series
      const updateQuery = `
        UPDATE race_series
        SET name = $1, description = $2, website = $3, is_active = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `;
      result = await pool.query(updateQuery, [
        name.trim(),
        description || null,
        website || null,
        is_active !== false,
        id
      ]);

      if (result.rows.length === 0) {
        await pool.end();
        return res.status(404).json({ error: 'Race series not found' });
      }
    } else {
      // Create new race series
      const insertQuery = `
        INSERT INTO race_series (name, description, website, user_id, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      result = await pool.query(insertQuery, [
        name.trim(),
        description || null,
        website || null,
        decoded.userId,
        is_active !== false
      ]);
    }

    await pool.end();

    res.json({
      success: true,
      raceSeries: result.rows[0],
      message: id ? 'Race series updated successfully' : 'Race series created successfully'
    });

  } catch (error) {
    console.error('Error saving race series:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Race series name already exists',
        details: 'A race series with this name already exists'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({
      error: 'Failed to save race series',
      details: error.message
    });
  }
};