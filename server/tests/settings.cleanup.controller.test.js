// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/system.service.js', () => ({
  systemService: { cleanupImages: vi.fn() }
}));
vi.mock('../services/settings.service.js', () => ({
  settingsService: { storage: { orphanPurge: { maxAgeHours: 36 } } },
  defaultProvider: vi.fn(),
  DEFAULT_SETTINGS: {}
}));
vi.mock('../middleware/error.middleware.js', () => ({
  handleError: vi.fn()
}));
vi.mock('../services/gemini.service.js', () => ({
  geminiConfig: vi.fn(),
  geminiService: {},
  modelCooldowns: {},
  DEFAULT_MODELS: [],
  DEFAULT_AUDIO_MODELS: []
}));
vi.mock('../services/local_llm.service.js', () => ({
  localLLMService: {},
  OLLAMA_DEFAULTS: {}
}));
vi.mock('../services/backup.service.js', () => ({
  backupService: {}
}));
vi.mock('../services/ai_usage.service.js', () => ({
  aiUsageService: {}
}));

import { cleanupImages } from '../controllers/system.controller.js';
import { systemService } from '../services/system.service.js';
import { settingsService } from '../services/settings.service.js';

describe('cleanup images controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the configured media grace period for manual cleanup', async () => {
    settingsService.storage.orphanPurge.maxAgeHours = 36;
    const result = { success: true, deletedCount: 2, reclaimedSpace: 1024 };
    vi.mocked(systemService.cleanupImages).mockResolvedValue(result);
    const response = { json: vi.fn() };

    await cleanupImages({}, response);

    expect(systemService.cleanupImages).toHaveBeenCalledWith({ minAgeMs: 36 * 60 * 60 * 1000 });
    expect(response.json).toHaveBeenCalledWith(result);
  });
});
