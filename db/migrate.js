// Run with: node db/migrate.js
// Requires POSTGRES_URL env var — loaded from .env.local since plain Node
// scripts don't auto-read it the way Next.js does.
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const candidates = ['.env.local', '.env'];
  for (const filename of candidates) {
    const envPath = path.join(__dirname, '..', filename);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
      console.log('Loaded env vars from', filename);
      return;
    }
  }
  console.warn('No .env.local or .env file found — relying on already-set environment variables.');
}

loadEnvLocal();

const { sql } = require('@vercel/postgres');

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  // Strip full-line comments from the whole file first, then split into
  // statements. Avoids a comment header directly above a CREATE TABLE
  // making the whole statement look like "just a comment" and get skipped.
  const withoutComments = schema
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

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