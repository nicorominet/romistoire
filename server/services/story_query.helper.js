/**
 * Helper for building common SQL query clauses for stories.
 */
class StoryQueryHelper {
    /**
     * Builds the WHERE clause for story filtering.
     * @param {Object} params - Filter parameters.
     * @returns {Object} { whereClause, params }
     */
    buildWhere({ locale = 'fr', theme, ageGroup, weekNumber, dayOfWeek, search, searchTerm, hasImage, hasAudio, seriesId, excludeSeriesId, source, editStatus }) {
        let whereClauses = ['s.locale = ?'];
        let params = [locale];

        const actualSearch = search || searchTerm;

        if (seriesId && seriesId !== 'all') {
            whereClauses.push('s.series_id = ?');
            params.push(seriesId);
        }

        if (excludeSeriesId) {
            whereClauses.push('(s.series_id != ? OR s.series_id IS NULL)');
            params.push(excludeSeriesId);
        }

        if (theme && theme !== 'all') {
            whereClauses.push('EXISTS (SELECT 1 FROM story_themes st_filter WHERE st_filter.story_id = s.id AND st_filter.theme_id = ?)');
            params.push(theme);
        }

        if (ageGroup && ageGroup !== 'all') {
            whereClauses.push('s.age_group = ?');
            params.push(ageGroup);
        }

        if (weekNumber) {
            whereClauses.push('s.week_number = ?');
            params.push(weekNumber);
        }

        if (dayOfWeek && dayOfWeek !== 'all') {
            whereClauses.push('s.day_order = ?');
            params.push(parseInt(dayOfWeek, 10));
        }

        if (actualSearch) {
            whereClauses.push('(s.title LIKE ? OR s.content LIKE ?)');
            params.push(`%${actualSearch}%`, `%${actualSearch}%`);
        }

        if (hasImage && hasImage !== 'all') {
            if (hasImage === 'yes') {
                whereClauses.push('EXISTS (SELECT 1 FROM illustrations i_filter WHERE i_filter.story_id = s.id)');
            } else if (hasImage === 'no') {
                whereClauses.push('NOT EXISTS (SELECT 1 FROM illustrations i_filter WHERE i_filter.story_id = s.id)');
            }
        }

        if (hasAudio && hasAudio !== 'all') {
            if (hasAudio === 'yes') {
                whereClauses.push('(s.audio_path IS NOT NULL AND s.audio_path != "")');
            } else if (hasAudio === 'no') {
                whereClauses.push('(s.audio_path IS NULL OR s.audio_path = "")');
            }
        }

        if (source && source !== 'all') {
            whereClauses.push('s.source = ?');
            params.push(source);
        }

        if (editStatus && editStatus !== 'all') {
            if (editStatus === 'edited') {
                whereClauses.push('s.is_manually_edited = TRUE');
            } else if (editStatus === 'original') {
                whereClauses.push('s.is_manually_edited = FALSE');
            }
        }

        return { whereClause: whereClauses.join(' AND '), params };
    }
}

export const storyQueryHelper = new StoryQueryHelper();
