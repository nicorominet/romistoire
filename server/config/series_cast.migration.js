/**
 * Framed generation: the bible of a series (one cast per age groups), the facts the weeks establish,
 * and the recap and audit of each week written with a cast. Facts and recaps are kept per age group:
 * each age group of a cast tells its own story with the same characters.
 * Idempotent: run at every startup by initializeDatabase().
 */

export async function migrateSeriesCasts(pool) {
  // Characters, rules and age groups are JSON: they are always read and written as a whole
  await pool.query(`
    CREATE TABLE IF NOT EXISTS series_casts (
      id VARCHAR(36) PRIMARY KEY,
      series_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      age_groups JSON NOT NULL,
      universe TEXT NULL,
      rules JSON NULL,
      characters JSON NOT NULL,
      reference_week INT NOT NULL DEFAULT 1,
      version INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_series_casts_series (series_id),
      CONSTRAINT fk_series_casts_series FOREIGN KEY (series_id) REFERENCES story_series(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS series_facts (
      id VARCHAR(36) PRIMARY KEY,
      cast_id VARCHAR(36) NOT NULL,
      age_group VARCHAR(10) NOT NULL,
      week_number INT NOT NULL,
      text VARCHAR(500) NOT NULL,
      status ENUM('proposed', 'approved', 'rejected') NOT NULL DEFAULT 'proposed',
      source_story_id VARCHAR(36) NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_series_facts_cast (cast_id, age_group, week_number),
      CONSTRAINT fk_series_facts_cast FOREIGN KEY (cast_id) REFERENCES series_casts(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS series_week_recaps (
      cast_id VARCHAR(36) NOT NULL,
      age_group VARCHAR(10) NOT NULL,
      week_number INT NOT NULL,
      recap TEXT NULL,
      audit JSON NULL,
      stale TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (cast_id, age_group, week_number),
      CONSTRAINT fk_series_week_recaps_cast FOREIGN KEY (cast_id) REFERENCES series_casts(id) ON DELETE CASCADE
    )
  `);

  // First version of these tables (before facts and recaps were kept per age group): no age_group column.
  // They are empty (every write names age_group), so the column takes an empty default.
  if (!(await hasColumn(pool, 'series_facts', 'age_group'))) {
    await pool.query(`
      ALTER TABLE series_facts
      ADD COLUMN age_group VARCHAR(10) NOT NULL DEFAULT '' AFTER cast_id,
      ADD INDEX idx_series_facts_cast_age (cast_id, age_group, week_number)
    `);
    console.log('Migration: age_group column added to series_facts.');
  }
  if (!(await hasColumn(pool, 'series_week_recaps', 'age_group'))) {
    // One statement: the foreign key on cast_id always keeps an index starting with it
    await pool.query(`
      ALTER TABLE series_week_recaps
      ADD COLUMN age_group VARCHAR(10) NOT NULL DEFAULT '' AFTER cast_id,
      DROP PRIMARY KEY,
      ADD PRIMARY KEY (cast_id, age_group, week_number)
    `);
    console.log('Migration: age_group column added to series_week_recaps.');
  }
}

const hasColumn = async (pool, table, column) => {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  return rows.length > 0;
};
