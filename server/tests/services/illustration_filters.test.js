// @vitest-environment node
// The illustration workshop filters the stories like the story list (same storyQueryHelper.buildWhere).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ query: vi.fn(async () => []), getConnection: vi.fn() }));
vi.mock('../../services/gemini.service.js', () => ({ geminiService: { apiKey: 'k', generateText: vi.fn() } }));
vi.mock('../../services/local_llm.service.js', () => ({ localLLMService: { generateText: vi.fn() } }));

const db = await import('../../config/database.js');
const { illustrationService } = await import('../../services/illustration.service.js');

const listCall = () => db.query.mock.calls.find(([sql]) => sql.includes('illustration_count'));

describe('illustration workshop filters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the stories without image by default', async () => {
    await illustrationService.findTodo();
    expect(listCall()[0]).toContain('NOT EXISTS (SELECT 1 FROM illustrations i_filter');
  });

  it('takes the series, theme, day and review filters of the story list', async () => {
    await illustrationService.findTodo({ seriesId: 'ser1', theme: 't1', dayOfWeek: '3', reviewStatus: 'to_review', hasImage: 'all' });
    const [sql, params] = listCall();
    expect(sql).toContain('s.series_id = ?');
    expect(sql).toContain('st_filter.theme_id = ?');
    expect(sql).toContain('s.day_order = ?');
    expect(sql).toContain('s.review_status = ?');
    expect(sql).not.toContain('i_filter.story_id = s.id)');
    expect(params).toEqual(expect.arrayContaining(['ser1', 't1', 3, 'to_review']));
  });
});
