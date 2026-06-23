// Pinapatakbo nito ang lahat ng .sql files sa /migrations folder, ayon sa pangalan (alphabetical)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Hahanapin ang ${files.length} migration file(s)...`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running: ${file}`);
    try {
      await pool.query(sql);
      console.log(`✓ Tagumpay: ${file}`);
    } catch (err) {
      console.error(`✗ Nabigo: ${file}`, err.message);
      process.exit(1);
    }
  }

  console.log('Tapos na lahat ng migrations.');
  await pool.end();
}

runMigrations();
