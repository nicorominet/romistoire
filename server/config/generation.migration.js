/**
 * Mass generation (server-side job queue): jobs, their units, and the link from each story to its job.
 * Idempotent: run at every startup by initializeDatabase().
 */

const hasColumn = async (pool, table, column) => {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
  return rows.length > 0;
};

export async function migrateGeneration(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id VARCHAR(36) PRIMARY KEY,
      status ENUM('queued', 'running', 'paused', 'cancelled', 'done', 'failed') NOT NULL DEFAULT 'queued',
      params JSON NOT NULL,
      total_units INT NOT NULL DEFAULT 0,
      done_units INT NOT NULL DEFAULT 0,
      created_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      current_label VARCHAR(255) NULL,
      provider VARCHAR(20) NOT NULL,
      model VARCHAR(100) NULL,
      log JSON NULL,
      created_at DATETIME NOT NULL,
      started_at DATETIME NULL,
      finished_at DATETIME NULL,
      INDEX idx_generation_jobs_status (status)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS generation_units (
      id VARCHAR(36) PRIMARY KEY,
      job_id VARCHAR(36) NOT NULL,
      position INT NOT NULL,
      week_number INT NOT NULL,
      age_group VARCHAR(10) NOT NULL,
      day VARCHAR(30) NOT NULL,
      status ENUM('pending', 'running', 'done', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
      context JSON NULL,
      story_ids JSON NULL,
      error TEXT NULL,
      attempts INT NOT NULL DEFAULT 0,
      model VARCHAR(100) NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_generation_units_job (job_id, position),
      CONSTRAINT fk_generation_units_job FOREIGN KEY (job_id) REFERENCES generation_jobs(id) ON DELETE CASCADE
    )
  `);

  // Every request sent to Gemini (successful or not): quota statistics (Settings > AI generation)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_requests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      at DATETIME(3) NOT NULL,
      model VARCHAR(100) NOT NULL,
      label VARCHAR(50) NOT NULL,
      outcome ENUM('ok', 'rate_limit', 'daily_quota', 'overloaded', 'timeout', 'error') NOT NULL,
      http_status INT NULL,
      duration_ms INT NULL,
      INDEX idx_ai_requests_at (at),
      INDEX idx_ai_requests_model_at (model, at)
    )
  `);

  if (!(await hasColumn(pool, 'stories', 'generation_job_id'))) {
    await pool.query(`
      ALTER TABLE stories
      ADD COLUMN generation_job_id VARCHAR(36) NULL AFTER series_id,
      ADD INDEX idx_stories_generation_job (generation_job_id)
    `);
    console.log('Migration: generation_job_id column added to stories.');
  }

  if (!(await hasColumn(pool, 'stories', 'summary'))) {
    // Summary written by the AI: context of the next days when a week is completed or resumed
    await pool.query('ALTER TABLE stories ADD COLUMN summary TEXT NULL AFTER illustration_prompt');
    console.log('Migration: summary column added to stories.');
  }

  if (!(await hasColumn(pool, 'stories', 'review_status'))) {
    // Existing stories count as reviewed: only stories generated from now on are flagged "to review"
    await pool.query(`
      ALTER TABLE stories
      ADD COLUMN review_status ENUM('to_review', 'validated') NOT NULL DEFAULT 'validated' AFTER generation_job_id
    `);
    console.log('Migration: review_status column added to stories.');
  }
}
