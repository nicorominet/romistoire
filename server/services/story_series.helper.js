import { v4 as uuidv4 } from 'uuid';

/**
 * Helper for managing story series and slot collisions (branching/aliasing).
 */
class StorySeriesHelper {
    /**
     * Resolves a series ID from either an existing ID or a name.
     * @param {Object} connection - DB connection.
     * @param {string} seriesId - Optional series ID.
     * @param {string} seriesName - Optional series name.
     * @returns {Promise<string|null>} Resolved series ID.
     */
    async resolveSeriesId(connection, seriesId, seriesName) {
        if (seriesId) return seriesId;
        seriesName = String(seriesName ?? '').replace(/\s+/g, ' ').trim();
        if (!seriesName) return null;

        // Names are unique since series are checked on creation; older duplicates: the main, oldest one
        const [existingSeries] = await connection.query(
            'SELECT id FROM story_series WHERE name = ? ORDER BY parent_series_id IS NOT NULL, created_at ASC LIMIT 1',
            [seriesName]
        );
        if (existingSeries.length > 0) {
            return existingSeries[0].id;
        }

        const newId = uuidv4();
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await connection.query(
            'INSERT INTO story_series (id, name, created_at) VALUES (?, ?, ?)',
            [newId, seriesName, now]
        );
        return newId;
    }

    /**
     * Detects collisions and handles branching/aliasing logic.
     * @param {Object} connection - DB connection.
     * @param {Object} storySlot - { weekNumber, dayOrder, ageGroup, locale, seriesId, excludeStoryId }
     *   excludeStoryId: story being updated, so it never collides with itself.
     * @param {string} seriesName - Current series name for alias naming.
     * @returns {Promise<string|null>} Output series ID (branched if necessary).
     */
    async handleCollisions(connection, slot, seriesName) {
        return (await this.resolveSlot(connection, slot, seriesName)).seriesId;
    }

    /**
     * Same as handleCollisions, but also tells whether the story was moved to an alias series,
     * so the client can warn the user.
     * A story collides only with stories of the same series (no series = only stories without series).
     * @returns {Promise<{seriesId: string|null, alias: {id: string, name: string}|null}>}
     */
    async resolveSlot(connection, { weekNumber, dayOrder, ageGroup, locale, seriesId, excludeStoryId = null }, seriesName) {
        let finalSeriesId = seriesId;
        
        let collisionQuery = 'SELECT id, series_id FROM stories WHERE week_number = ? AND day_order = ? AND age_group = ? AND locale = ?';
        let collisionParams = [weekNumber, dayOrder, ageGroup, locale];

        if (excludeStoryId) {
            collisionQuery += ' AND id <> ?';
            collisionParams.push(excludeStoryId);
        }
        
        if (finalSeriesId) {
            collisionQuery += ' AND series_id = ?';
            collisionParams.push(finalSeriesId);
        } else {
            collisionQuery += ' AND series_id IS NULL';
        }

        const [collision] = await connection.query(collisionQuery, collisionParams);

        if (collision.length > 0) {
            console.log(`Collision detected for Week ${weekNumber}, Day ${dayOrder}, Age ${ageGroup}. Creating Branch/Alias.`);
            
            let baseSeriesName = seriesName || "Série Principale";
            let rootSeriesId = finalSeriesId || null;
            
            let aliasCounter = 1;
            let resolvedSeriesId = null;
            let aliasName = null;
            
            while (!resolvedSeriesId) {
                aliasName = `${baseSeriesName} (Alias ${aliasCounter})`;
                
                const [aliasSeries] = await connection.query('SELECT id FROM story_series WHERE name = ?', [aliasName]);
                
                if (aliasSeries.length > 0) {
                    const existingAliasId = aliasSeries[0].id;
                    const [aliasCollision] = await connection.query(
                         'SELECT id FROM stories WHERE week_number = ? AND day_order = ? AND age_group = ? AND locale = ? AND series_id = ? AND id <> ?',
                         [weekNumber, dayOrder, ageGroup, locale, existingAliasId, excludeStoryId || '']
                    );
                    
                    if (aliasCollision.length === 0) {
                        resolvedSeriesId = existingAliasId;
                    } else {
                        aliasCounter++;
                    }
                } else {
                    resolvedSeriesId = uuidv4();
                    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    await connection.query(
                        'INSERT INTO story_series (id, name, created_at, parent_series_id) VALUES (?, ?, ?, ?)',
                        [resolvedSeriesId, aliasName, now, rootSeriesId]
                    );
                }
            }
            return { seriesId: resolvedSeriesId, alias: { id: resolvedSeriesId, name: aliasName } };
        }

        return { seriesId: finalSeriesId, alias: null };
    }
}

export const storySeriesHelper = new StorySeriesHelper();
