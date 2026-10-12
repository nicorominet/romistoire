// @vitest-environment node
// Coverage of the mass generation per series: every story, the stories without series, or one series.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/weeklyTheme.service.js', () => ({ weeklyThemeService: { findAll: vi.fn(async () => [{ week_number: 43, theme_name: 'Halloween' }]) } }));
vi.mock('../../services/series_cast.service.js', () => ({
  seriesCastService: {
    list: vi.fn(async () => ({ casts: [{ ageGroups: ['2-3', '4-6'] }], legacySheet: '' })),
    seriesName: vi.fn(async () => 'Famille Silvestre')
  }
}));

const db = await import('../../config/database.js');
const { generationJobService } = await import('../../services/generation_job.service.js');

const coverageCall = () => db.query.mock.calls.find(([sql]) => sql.includes('COUNT(DISTINCT day_order)'));

describe('coverage per series', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue([{ week_number: 43, age_group: '2-3', total: 7, days: 7 }]);
  });

  it('counts every story by default, as before', async () => {
    const result = await generationJobService.coverage();
    expect(coverageCall()[0]).not.toContain('series_id');
    expect(coverageCall()[1]).toEqual(['fr']);
    expect(result.cells['43:2-3']).toEqual({ total: 7, days: 7 });
    expect(result.series).toBeUndefined();
  });

  it('counts the stories without series', async () => {
    await generationJobService.coverage({ series: 'none' });
    expect(coverageCall()[0]).toContain('series_id IS NULL');
  });

  it('counts one series and tells its cast age groups', async () => {
    const result = await generationJobService.coverage({ series: 'ser1' });
    expect(coverageCall()[0]).toContain('series_id = ?');
    expect(coverageCall()[1]).toEqual(['fr', 'ser1']);
    expect(result.series).toEqual({ id: 'ser1', name: 'Famille Silvestre', framed: true, castAges: ['2-3', '4-6'] });
  });
});
