import { describe, it, expect } from 'vitest';
import { ModelCooldowns, msUntilPacificMidnight, parseRateLimit } from '../../services/helpers/model_cooldown.helper.js';

describe('ModelCooldowns', () => {
  it('should skip a model until its cooldown ends', () => {
    let now = 1000;
    const cooldowns = new ModelCooldowns(() => now);
    cooldowns.skip('a', 500, 'overloaded');

    expect(cooldowns.filter(['a', 'b'])).toEqual({ models: ['b'], skipped: [{ model: 'a', reason: 'overloaded' }] });
    now = 1500;
    expect(cooldowns.filter(['a', 'b'])).toEqual({ models: ['a', 'b'], skipped: [] });
  });

  it('should still try every model when all are cooling down', () => {
    const cooldowns = new ModelCooldowns(() => 0);
    cooldowns.skip('a', 100, 'timeout');
    cooldowns.skip('b', 100, 'timeout');

    expect(cooldowns.filter(['a', 'b']).models).toEqual(['a', 'b']);
  });
});

describe('parseRateLimit', () => {
  it('should recognize a daily quota and a per-minute delay', () => {
    expect(parseRateLimit('{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}').daily).toBe(true);
    expect(parseRateLimit('{"retryDelay": "27s"}')).toEqual({ daily: false, retryDelayMs: 27000 });
    expect(parseRateLimit('')).toEqual({ daily: false, retryDelayMs: null });
  });
});

describe('msUntilPacificMidnight', () => {
  it('should count down to the next midnight in Los Angeles', () => {
    // 2026-10-07 23:00 UTC = 16:00 in Los Angeles (UTC-7): 8 h left
    expect(msUntilPacificMidnight(new Date('2026-10-07T23:00:00Z'))).toBe(8 * 3600 * 1000);
  });
});
