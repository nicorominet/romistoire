/**
 * Theme merge, run on a connection already inside a transaction.
 * Kept free of database imports so the startup migration (server/config/theme.migration.js)
 * and the theme service share the same rules.
 */

/**
 * Moves the links of one junction table from `sourceId` to `targetId`.
 * Rows that already link the same owner to the target are dropped (UNIQUE(owner, theme_id)),
 * keeping the "primary" flag when the source was primary.
 */
const moveLinks = async (connection, table, ownerColumn, sourceId, targetId) => {
  const [both] = await connection.query(
    `SELECT s.${ownerColumn} AS owner, s.is_primary FROM ${table} s
     INNER JOIN ${table} t ON t.${ownerColumn} = s.${ownerColumn} AND t.theme_id = ?
     WHERE s.theme_id = ?`,
    [targetId, sourceId]
  );
  for (const row of both) {
    if (Number(row.is_primary) === 1) {
      await connection.query(`UPDATE ${table} SET is_primary = TRUE WHERE ${ownerColumn} = ? AND theme_id = ?`, [row.owner, targetId]);
    }
    await connection.query(`DELETE FROM ${table} WHERE ${ownerColumn} = ? AND theme_id = ?`, [row.owner, sourceId]);
  }
  const [result] = await connection.query(`UPDATE ${table} SET theme_id = ? WHERE theme_id = ?`, [targetId, sourceId]);
  return (result?.affectedRows || 0) + both.length;
};

/**
 * Merges `sourceIds` into `targetId`: story links and version links move to the target,
 * then the source themes are deleted. No story nor version loses a theme.
 * @param {Object} connection - mysql2 connection (in a transaction).
 * @param {string[]} sourceIds - Themes to merge (deleted afterwards).
 * @param {string} targetId - Theme kept.
 * @returns {Promise<{merged: number, movedStories: number}>}
 */
export const mergeThemesOnConnection = async (connection, sourceIds, targetId) => {
  let merged = 0;
  let movedStories = 0;
  for (const sourceId of [...new Set(sourceIds)]) {
    if (!sourceId || sourceId === targetId) continue;
    movedStories += await moveLinks(connection, 'story_themes', 'story_id', sourceId, targetId);
    await moveLinks(connection, 'story_version_themes', 'story_version_id', sourceId, targetId);
    await connection.query('DELETE FROM themes WHERE id = ?', [sourceId]);
    merged++;
  }
  return { merged, movedStories };
};
