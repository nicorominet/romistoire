import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../config/env.config.js';
import { SAMPLE_TEXT } from './helpers/voice.helper.js';

// Out of uploads/: not user data (no export, no orphan purge). Gitignored.
const CACHE_DIR = path.join(ENV_CONFIG.PROJECT_ROOT, 'server', 'cache', 'voice-samples');

const MIME_TYPES = { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', webm: 'audio/webm' };

/**
 * Cache key of a sample: everything that changes what is heard, the sample text included
 * (a new text makes new files).
 * @param {{voice: string, characterVoice: string, style: string, pace: string, multiSpeaker: boolean}} resolved
 */
export const sampleKey = (resolved) =>
  crypto.createHash('sha256').update(JSON.stringify({
    voice: resolved.voice,
    characterVoice: resolved.multiSpeaker ? resolved.characterVoice : null,
    style: resolved.style,
    pace: resolved.pace,
    multiSpeaker: resolved.multiSpeaker,
    text: SAMPLE_TEXT
  })).digest('hex').slice(0, 32);

/**
 * Voice samples of Settings > reading voice, kept on disk: the TTS models allow 10 requests a day each,
 * so listening again to a voice already tried costs nothing.
 */
export const voiceSampleService = {
  dir: CACHE_DIR,

  /**
   * @param {Object} resolved - Resolved voice options (voice.helper resolveAudioOptions).
   * @param {() => Promise<{audioBuffer: Buffer, mimeType: string, extension: string}>} generate - Called on a miss.
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string, cached: boolean}>}
   */
  async get(resolved, generate) {
    const key = sampleKey(resolved);
    const existing = fs.existsSync(this.dir) ? fs.readdirSync(this.dir).find(file => file.startsWith(`${key}.`)) : null;
    if (existing) {
      const extension = path.extname(existing).slice(1);
      return { audioBuffer: fs.readFileSync(path.join(this.dir, existing)), mimeType: MIME_TYPES[extension] ?? 'audio/wav', cached: true };
    }

    const { audioBuffer, mimeType, extension } = await generate();
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(path.join(this.dir, `${key}.${extension || 'wav'}`), audioBuffer);
    } catch (error) {
      // The sample is still played; it will just be generated again next time
      console.warn('[VoiceSample] Could not cache the sample:', error.message);
    }
    return { audioBuffer, mimeType, cached: false };
  }
};
