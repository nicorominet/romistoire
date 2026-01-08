import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'imagitales',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true // Ensure this is enabled for init scripts
};

console.log('Initializing database connection with config:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database
});

let pool;
try {
  pool = mysql.createPool(dbConfig);
  if (process.env.NODE_ENV !== 'production') {
    pool.getConnection()
      .then(connection => {
        console.log('✅ Database connection successful');
        connection.release();
      })
      .catch(err => {
        console.error('❌ Failed to connect to database:', err);
      });
  }
} catch (error) {
  console.error('Failed to create database pool:', error);
  throw error;
}

if (process.env.NODE_ENV !== 'production') {
  pool.on('error', (err) => {
    console.error('🔴 DB Pool: Error event:', err);
  });
}

function dbLogger(operation, details, duration) {
  const timestamp = new Date().toISOString();
  const log = {
    timestamp,
    operation,
    duration: duration ? `${duration}ms` : undefined,
    ...details
  };
  if (operation.includes('error')) console.error('DB Error:', log);
  else if (process.env.NODE_ENV !== 'production') console.log('DB:', log);
}

export async function query(sql, params = []) {
  const start = Date.now();
  try {
    const [results] = await pool.execute(sql, params);
    const duration = Date.now() - start;
    
    // Log successful query
    logger.info('DB', 'Query Executed', {
        sql: sql.substring(0, 1000), // Truncate very long queries
        params: JSON.stringify(params), 
        duration: `${duration}ms`,
        rows: Array.isArray(results) ? results.length : 0
    });

    return results;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Log error
    logger.error('DB', 'Query Failed', {
        sql,
        params,
        error: error.message,
        duration: `${duration}ms`
    });

    console.error('Database query error:', {
      message: error.message,
      sql: error.sql,
      parameters: params
    });
    throw error;
  }
}

export async function getConnection() {
  return await pool.getConnection();
}

export async function closeConnections() {
  await pool.end();
}

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    return false;
  }
}

export async function initializeDatabase() {
  try {
    const [tables] = await pool.query('SHOW TABLES');
    const tableList = tables.map((row) => Object.values(row)[0]);
    if (!tableList.includes('stories')) {
      console.log('Initializing database tables...');
      
      // Adjust path to point to root/scripts
      const scriptPath = path.join(__dirname, '../../scripts/init-db.sql');
      
      if (fs.existsSync(scriptPath)) {
        const initScript = fs.readFileSync(scriptPath, 'utf8');
        const statements = initScript.split(';').filter((stmt) => stmt.trim().length > 0);
        for (const stmt of statements) {
            await pool.query(stmt);
        }
        console.log('Database initialization complete');
      } else {
        console.warn('Init script not found at:', scriptPath);
      }
    }

    // Migrations
    if (!tableList.includes('story_series')) {
      await pool.query(`
        CREATE TABLE story_series (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_at DATETIME NOT NULL
        )
      `);
      console.log('Migration: story_series table created.');
    }

    const [columns] = await pool.query('SHOW COLUMNS FROM stories LIKE "series_id"');
    if (columns.length === 0) {
      await pool.query(`
        ALTER TABLE stories
        ADD COLUMN series_id VARCHAR(36) NULL,
        ADD CONSTRAINT fk_stories_series
        FOREIGN KEY (series_id) REFERENCES story_series(id) ON DELETE SET NULL
      `);
      console.log('Migration: series_id column added.');
    }


    try {
      const [seriesColumns] = await pool.query('SHOW COLUMNS FROM story_series LIKE "parent_series_id"');
      if (seriesColumns.length === 0) {
        await pool.query(`
          ALTER TABLE story_series
          ADD COLUMN parent_series_id VARCHAR(36) NULL,
          ADD CONSTRAINT fk_series_parent
          FOREIGN KEY (parent_series_id) REFERENCES story_series(id) ON DELETE SET NULL
        `);
        console.log('Migration: parent_series_id column added to story_series.');
      }

      const [seriesLocaleColumns] = await pool.query('SHOW COLUMNS FROM story_series LIKE "locale"');
      if (seriesLocaleColumns.length === 0) {
        await pool.query(`
          ALTER TABLE story_series
          ADD COLUMN locale VARCHAR(5) NULL DEFAULT 'fr',
          ADD INDEX idx_series_locale (locale)
        `);
        console.log('Migration: locale column added to story_series.');
      }

      const [storySourceColumns] = await pool.query('SHOW COLUMNS FROM stories LIKE "source"');
      if (storySourceColumns.length === 0) {
        await pool.query(`
          ALTER TABLE stories
          ADD COLUMN source ENUM('manual', 'gemini', 'ollama') DEFAULT 'manual' AFTER locale
        `);
        console.log('Migration: source column added to stories.');
      }

      const [storyEditedColumns] = await pool.query('SHOW COLUMNS FROM stories LIKE "is_manually_edited"');
      if (storyEditedColumns.length === 0) {
        await pool.query(`
          ALTER TABLE stories
          ADD COLUMN is_manually_edited BOOLEAN DEFAULT FALSE AFTER source
        `);
        console.log('Migration: is_manually_edited column added to stories.');
      }

      const [versionEditedColumns] = await pool.query('SHOW COLUMNS FROM story_versions LIKE "is_manually_edited"');
      if (versionEditedColumns.length === 0) {
        await pool.query(`
          ALTER TABLE story_versions
          ADD COLUMN is_manually_edited BOOLEAN DEFAULT FALSE AFTER version
        `);
        console.log('Migration: is_manually_edited column added to story_versions.');
      }
    } catch (migError) {
       console.error("Migration Failed:", migError);
       fs.writeFileSync(path.join(__dirname, '../../migration_debug.log'), `Migration Error: ${migError.message}\n${migError.stack}`);
    }

  } catch (error) {
    console.error('Database initialization error:', error);
    throw new Error('Failed to initialize database');
  }
}
