import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  console.log('🔄 Initializing NOTE AI PostgreSQL Database & Extensions...');

  try {
    // 1. Run schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📦 Executing schema.sql...');
    await query(schemaSql);
    console.log('✅ Schema and vector extensions initialized successfully!');

    // 2. Check if --seed flag was passed
    const shouldSeed = process.argv.includes('--seed');
    if (shouldSeed) {
      console.log('🌱 Populating database with seed data...');
      const seedPath = path.join(__dirname, 'seed.sql');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await query(seedSql);
      console.log('✅ Seed data successfully inserted!');
    }

    console.log('🎉 Database initialization complete.');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
