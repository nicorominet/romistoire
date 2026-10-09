import { normalizeThemeName } from '../services/helpers/theme_name.helper.js';
import { mergeThemesOnConnection } from '../services/helpers/theme_merge.helper.js';

const columnExists = async (pool, table, column) =>
  (await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]))[0].length > 0;

const indexExists = async (pool, table, index) =>
  (await pool.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [index]))[0].length > 0;

/**
 * Theme model migration (idempotent, run at startup):
 * - themes: normalized_name (unique), updated_at, source, needs_review, longer icon;
 * - existing duplicates ("Nature" / "nature") merged without losing story or version links;
 * - weekly_themes.theme_id (briefly added, then dropped): a week's topic is free text, not a story theme.
 *   The linked theme's current name/description are copied back into the week before the column is dropped.
 * @param {import('mysql2/promise').Pool} pool
 */
export async function migrateThemes(pool) {
  // 1. Columns
  const themeColumns = [
    ['normalized_name', 'ADD COLUMN normalized_name VARCHAR(100) NULL AFTER name'],
    ['updated_at', 'ADD COLUMN updated_at DATETIME NULL AFTER created_at'],
    ['source', "ADD COLUMN source ENUM('manual', 'ai') NOT NULL DEFAULT 'manual'"],
    ['needs_review', 'ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT FALSE']
  ];
  for (const [column, ddl] of themeColumns) {
    if (!(await columnExists(pool, 'themes', column))) {
      await pool.query(`ALTER TABLE themes ${ddl}`);
      console.log(`Migration: themes.${column} added.`);
    }
  }
  await pool.query('ALTER TABLE themes MODIFY COLUMN icon VARCHAR(16) NULL');

  // 2. Normalized names (also refreshes rows written by older code)
  const [themes] = await pool.query(`
    SELECT t.id, t.name, t.normalized_name, t.created_at,
           (SELECT COUNT(*) FROM story_themes st WHERE st.theme_id = t.id) AS storyCount
    FROM themes t
  `);
  for (const theme of themes) {
    const normalized = normalizeThemeName(theme.name) || theme.id;
    if (theme.normalized_name !== normalized) {
      await pool.query('UPDATE themes SET normalized_name = ? WHERE id = ?', [normalized, theme.id]);
    }
    theme.normalized_name = normalized;
  }

  // 3. Merge duplicates: keep the most used theme (then the oldest)
  const groups = new Map();
  for (const theme of themes) {
    if (!groups.has(theme.normalized_name)) groups.set(theme.normalized_name, []);
    groups.get(theme.normalized_name).push(theme);
  }
  const duplicates = [...groups.values()].filter(group => group.length > 1);
  if (duplicates.length > 0) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const group of duplicates) {
        group.sort((a, b) => Number(b.storyCount) - Number(a.storyCount) || new Date(a.created_at) - new Date(b.created_at));
        const [target, ...sources] = group;
        await mergeThemesOnConnection(connection, sources.map(t => t.id), target.id);
      }
      await connection.commit();
      console.log(`Migration: ${duplicates.length} group(s) of duplicate themes merged.`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 4. Unique name
  if (!(await indexExists(pool, 'themes', 'uq_themes_normalized_name'))) {
    await pool.query('ALTER TABLE themes MODIFY COLUMN normalized_name VARCHAR(100) NOT NULL');
    await pool.query('ALTER TABLE themes ADD UNIQUE INDEX uq_themes_normalized_name (normalized_name)');
    console.log('Migration: unique index on themes.normalized_name added.');
  }

  // 5. Weeks are free topics again: unlink them from themes
  if (await columnExists(pool, 'weekly_themes', 'theme_id')) {
    await pool.query(`
      UPDATE weekly_themes w INNER JOIN themes t ON t.id = w.theme_id
      SET w.theme_name = t.name, w.theme_description = COALESCE(NULLIF(t.description, ''), w.theme_description)
    `);
    const [[fk]] = await pool.query(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'weekly_themes' AND CONSTRAINT_NAME = 'fk_weekly_themes_theme'`
    );
    if (fk) await pool.query('ALTER TABLE weekly_themes DROP FOREIGN KEY fk_weekly_themes_theme');
    await pool.query('ALTER TABLE weekly_themes DROP COLUMN theme_id');
    console.log('Migration: weekly_themes.theme_id dropped (week topics are free text).');
  }
}
