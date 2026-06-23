const { Pool } = require('pg');

// Gumagamit ng connection string mula sa .env file (DATABASE_URL)
// Maglagay ng ssl option kapag production (kailangan ito ng Railway/Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error sa PostgreSQL pool:', err);
});

module.exports = pool;
