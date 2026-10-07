import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../../config/database.js';
import { weeklyThemeService } from '../../services/weeklyTheme.service.js';
import { themeService } from '../../services/theme.service.js';
import { NotFoundError, ValidationError } from '../../middleware/error.middleware.js';

vi.mock('../../config/database.js', () => ({
  query: vi.fn(),
  getConnection: vi.fn()
}));

vi.mock('../../services/theme.service.js', () => ({
  themeService: { findById: vi.fn(), create: vi.fn(), invalidateCache: vi.fn() }
}));

describe('WeeklyThemeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue([]);
  });

  it('should expose the linked theme name, color and icon', async () => {
    db.query.mockResolvedValue([{ week_number: 3, theme_id: 't1', theme_name: 'La pluie', theme_description: null, color: '#2196F3', icon: '🌧️' }]);

    expect(await weeklyThemeService.findAll()).toEqual([
      { week_number: 3, theme_id: 't1', theme_name: 'La pluie', theme_description: '', color: '#2196F3', icon: '🌧️' }
    ]);
    expect(db.query.mock.calls[0][0]).toContain('LEFT JOIN themes t ON t.id = w.theme_id');
  });

  it('should link a week to an existing theme', async () => {
    themeService.findById.mockResolvedValue({ id: 't1', name: 'La pluie', description: 'Météo' });

    await weeklyThemeService.setWeek('12', { themeId: 't1' });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual([12, 't1', 'La pluie', 'Météo']);
  });

  it('should create the theme when only a name is given', async () => {
    themeService.create.mockResolvedValue({ theme: { id: 'new', name: 'Volcans', description: '' }, existing: false });

    await weeklyThemeService.setWeek(5, { themeName: 'Volcans' });

    expect(themeService.create).toHaveBeenCalledWith({ name: 'Volcans' });
    expect(db.query.mock.calls[0][1]).toEqual([5, 'new', 'Volcans', null]);
  });

  it('should validate the week and the theme', async () => {
    await expect(weeklyThemeService.setWeek(54, { themeId: 't1' })).rejects.toBeInstanceOf(ValidationError);
    await expect(weeklyThemeService.setWeek(1, {})).rejects.toBeInstanceOf(ValidationError);
    themeService.findById.mockResolvedValue(null);
    await expect(weeklyThemeService.setWeek(1, { themeId: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
