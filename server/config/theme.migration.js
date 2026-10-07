import { v4 as uuidv4 } from 'uuid';
import { normalizeThemeName } from '../services/helpers/theme_name.helper.js';
import { mergeThemesOnConnection } from '../services/helpers/theme_merge.helper.js';

const columnExists = async (pool, table, column) =>
  (await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]))[0].length > 0;

const indexExists = async (pool, table, index) =>
  (await pool.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [index]))[0].length > 0;

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * Theme model migration (idempotent, run at startup):
 * - themes: normalized_name (unique), updated_at, source, needs_review, longer icon;
 * - existing duplicates ("Nature" / "nature") merged without losing story or version links;
 * - weekly_themes.theme_id: each week linked to a theme (created from the week's name if needed).
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

  if (!(await columnExists(pool, 'weekly_themes', 'theme_id'))) {
    await pool.query(`
      ALTER TABLE weekly_themes
      ADD COLUMN theme_id VARCHAR(36) NULL AFTER week_number,
      ADD CONSTRAINT fk_weekly_themes_theme FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE SET NULL
    `);
    console.log('Migration: weekly_themes.theme_id added.');
  }

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

  // 5. Link weeks to themes
  const [unlinkedWeeks] = await pool.query(
    "SELECT week_number, theme_name, theme_description FROM weekly_themes WHERE theme_id IS NULL AND TRIM(theme_name) <> ''"
  );
  for (const week of unlinkedWeeks) {
    const normalized = normalizeThemeName(week.theme_name);
    if (!normalized) continue;
    const [[existing]] = await pool.query('SELECT id FROM themes WHERE normalized_name = ?', [normalized]);
    let themeId = existing?.id;
    if (!themeId) {
      themeId = uuidv4();
      await pool.query(
        'INSERT INTO themes (id, name, normalized_name, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [themeId, String(week.theme_name).trim().slice(0, 100), normalized, week.theme_description || '', '#6366f1', now()]
      );
    }
    await pool.query('UPDATE weekly_themes SET theme_id = ? WHERE week_number = ?', [themeId, week.week_number]);
  }
  if (unlinkedWeeks.length > 0) console.log(`Migration: ${unlinkedWeeks.length} week(s) linked to a theme.`);
}
