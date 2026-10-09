import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../config/database.js';
import { weeklyThemeService } from '../../services/weeklyTheme.service.js';
import { ValidationError } from '../../middleware/error.middleware.js';

vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

describe('WeeklyThemeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue([]);
  });

  it('should return the topics of the weeks', async () => {
    db.query.mockResolvedValue([{ week_number: '3', theme_name: 'La pluie', theme_description: null }]);

    expect(await weeklyThemeService.findAll()).toEqual([
      { week_number: 3, theme_name: 'La pluie', theme_description: '' }
    ]);
    expect(db.query.mock.calls[0][0]).not.toContain('JOIN');
  });

  it('should save a free topic with its description', async () => {
    await weeklyThemeService.setWeek('12', { name: '  Les citrouilles ', description: 'Halloween approche' });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual([12, 'Les citrouilles', 'Halloween approche']);
  });

  it('should store an empty description as null', async () => {
    await weeklyThemeService.setWeek(5, { name: 'Volcans' });
    expect(db.query.mock.calls[0][1]).toEqual([5, 'Volcans', null]);
  });

  it('should validate the week and the topic', async () => {
    await expect(weeklyThemeService.setWeek(54, { name: 'x' })).rejects.toBeInstanceOf(ValidationError);
    await expect(weeklyThemeService.setWeek(1, {})).rejects.toBeInstanceOf(ValidationError);
    await expect(weeklyThemeService.setWeek(1, { name: 'x'.repeat(151) })).rejects.toBeInstanceOf(ValidationError);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('should clear legacy weeks beyond 53', async () => {
    await weeklyThemeService.clearWeek(88);
    expect(db.query).toHaveBeenCalledWith('DELETE FROM weekly_themes WHERE week_number = ?', [88]);
    await expect(weeklyThemeService.clearWeek(0)).rejects.toBeInstanceOf(ValidationError);
  });

  it('should skip unnamed weeks in a batch update', async () => {
    await weeklyThemeService.update([
      { week_number: 1, theme_name: '' },
      { week_number: 2, theme_name: 'Neige', theme_description: 'Hiver' }
    ]);
    expect(db.query.mock.calls[0][1]).toEqual([2, 'Neige', 'Hiver']);
  });
});
