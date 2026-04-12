const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        x FLOAT DEFAULT 0,
        y FLOAT DEFAULT 5,
        z FLOAT DEFAULT 0,
        world_id TEXT DEFAULT 'Lobby',
        color VARCHAR(20) DEFAULT '#ffffff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS world_id TEXT DEFAULT \'Lobby\'');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS worlds (
        world_id TEXT PRIMARY KEY,
        seed BIGINT NOT NULL,
        voxel_data JSONB NOT NULL,
        materials JSONB,
        structures JSONB,
        stats JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_worlds_seed ON worlds(seed)');

    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
};

module.exports = { pool, initializeDatabase };
