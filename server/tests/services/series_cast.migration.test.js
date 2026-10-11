// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { migrateSeriesCasts } from '../../config/series_cast.migration.js';

/** Pool whose SHOW COLUMNS answers whether age_group exists. */
const poolWith = (hasAgeGroup) => ({
  query: vi.fn(async (sql) => (sql.startsWith('SHOW COLUMNS') ? [hasAgeGroup ? [{ Field: 'age_group' }] : []] : [{}]))
});
const alters = (pool) => pool.query.mock.calls.map(([sql]) => sql).filter(sql => sql.includes('ALTER TABLE'));

describe('migrateSeriesCasts', () => {
  it('adds age_group to the tables created by the first version', async () => {
    const pool = poolWith(false);
    await migrateSeriesCasts(pool);
    const sql = alters(pool);
    expect(sql).toHaveLength(2);
    expect(sql[0]).toContain('ALTER TABLE series_facts');
    expect(sql[1]).toMatch(/ALTER TABLE series_week_recaps[\s\S]*DROP PRIMARY KEY[\s\S]*ADD PRIMARY KEY \(cast_id, age_group, week_number\)/);
  });

  it('leaves up-to-date tables alone', async () => {
    const pool = poolWith(true);
    await migrateSeriesCasts(pool);
    expect(alters(pool)).toEqual([]);
  });
});
