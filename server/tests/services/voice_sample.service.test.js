// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sampleKey, voiceSampleService } from '../../services/voice_sample.service.js';
import { resolveAudioOptions } from '../../services/helpers/voice.helper.js';

describe('voiceSampleService', () => {
  const realDir = voiceSampleService.dir;
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-samples-'));
    voiceSampleService.dir = dir;
  });
  afterEach(() => {
    voiceSampleService.dir = realDir;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const resolved = resolveAudioOptions({ voice: 'Kore', characterVoice: 'Puck' }, {}, '4-6');

  it('generates a sample once, then serves it from the disk', async () => {
    const generate = vi.fn().mockResolvedValue({ audioBuffer: Buffer.from([1, 2, 3]), mimeType: 'audio/wav', extension: 'wav' });

    const first = await voiceSampleService.get(resolved, generate);
    const second = await voiceSampleService.get(resolved, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second).toMatchObject({ cached: true, mimeType: 'audio/wav' });
    expect([...second.audioBuffer]).toEqual([1, 2, 3]);
  });

  it('keys the cache on what is heard only', () => {
    // The characters' voice is not heard with one voice
    expect(sampleKey({ ...resolved, characterVoice: 'Fenrir' })).toBe(sampleKey(resolved));
    expect(sampleKey({ ...resolved, multiSpeaker: true })).not.toBe(sampleKey(resolved));
    expect(sampleKey({ ...resolved, voice: 'Leda' })).not.toBe(sampleKey(resolved));
    expect(sampleKey({ ...resolved, pace: 'lively' })).not.toBe(sampleKey(resolved));
  });
});
