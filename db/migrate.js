// Run with: node db/migrate.js
// Requires POSTGRES_URL env var (auto-set by Vercel Postgres integration)
const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Split on semicolons that end a statement (naive but fine for this schema)
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    console.log('Running:', stmt.slice(0, 60).replace(/\n/g, ' ') + '...');
    await sql.query(stmt);
  }
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
