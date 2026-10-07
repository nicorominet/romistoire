// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/logger.service.js', () => ({
  logger: { ai: vi.fn() }
}));

process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODELS = 'model-a,model-b';
const { geminiService, GeminiFatalError, toPlayableAudio, buildStoryRequestBody } = await import('../../services/gemini.service.js');
// The service reads the key at construction time
geminiService.apiKey = 'test-key';

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body)
});

const storyBody = (text, finishReason = 'STOP') => ({ candidates: [{ content: { parts: [{ text }] }, finishReason }] });

describe('GeminiService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const run = async (promise) => {
    const settled = promise.then(value => ({ value }), error => ({ error }));
    await vi.runAllTimersAsync();
    return settled;
  };

  it('should not fall back to another model on an invalid key (fatal 400)', async () => {
    fetch.mockResolvedValue(jsonResponse(400, { error: { message: 'API key not valid.' } }));

    const { error } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(error).toBeInstanceOf(GeminiFatalError);
    expect(error.message).toContain('API key not valid.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry the same model on 503 then succeed', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'overloaded' } }))
      .mockResolvedValueOnce(jsonResponse(200, storyBody('Il était une fois')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(value.text).toBe('Il était une fois');
    expect(value.model).toBe('model-a');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([url]) => url.includes('model-a'))).toBe(true);
  });

  it('should move to the next model on 404', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse(404, { error: { message: 'not found' } }))
      .mockResolvedValueOnce(jsonResponse(200, storyBody('Histoire')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(value.model).toBe('model-b');
  });

  it('should ignore thought parts of thinking models', async () => {
    fetch.mockResolvedValue(jsonResponse(200, {
      candidates: [{ content: { parts: [{ text: 'réflexion', thought: true }, { text: '{"stories":[]}' }] }, finishReason: 'STOP' }]
    }));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(value.text).toBe('{"stories":[]}');
  });

  it('should flag a truncated answer and send a bigger budget for a week', async () => {
    fetch.mockResolvedValue(jsonResponse(200, storyBody('Début...', 'MAX_TOKENS')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Toute la semaine' }));

    expect(value.truncated).toBe(true);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.generationConfig.maxOutputTokens).toBe(32768);
  });

  it('should refuse a blocked answer', async () => {
    fetch.mockResolvedValue(jsonResponse(200, storyBody('', 'SAFETY')));

    const { error } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(error.message).toContain('SAFETY');
  });
});

describe('buildStoryRequestBody', () => {
  it('should send systemInstruction and a JSON schema to Gemini models', () => {
    const body = buildStoryRequestBody('gemini-3.5-flash', 'SYSTEM', 'PROMPT', 8192);

    expect(body.systemInstruction.parts[0].text).toBe('SYSTEM');
    expect(body.contents[0].parts[0].text).toBe('PROMPT');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.properties.stories).toBeDefined();
    expect(body.generationConfig.maxOutputTokens).toBe(8192);
  });

  it('should inline the instruction and skip JSON mode for Gemma models', () => {
    const body = buildStoryRequestBody('gemma-4-31b-it', 'SYSTEM', 'PROMPT', 8192);

    expect(body.systemInstruction).toBeUndefined();
    expect(body.generationConfig.responseMimeType).toBeUndefined();
    expect(body.generationConfig.responseSchema).toBeUndefined();
    expect(body.contents[0].parts[0].text).toBe('SYSTEM\n\nPROMPT');
  });
});

describe('toPlayableAudio', () => {
  const pcm = Buffer.from([1, 2, 3, 4]);

  it('should wrap raw PCM in a WAV header using the advertised rate', () => {
    const audio = toPlayableAudio(pcm, 'audio/L16;codec=pcm;rate=16000');

    expect(audio.extension).toBe('wav');
    expect(audio.audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    expect(audio.audioBuffer.readUInt32LE(24)).toBe(16000);
  });

  it('should keep already encoded mp3 as is', () => {
    const audio = toPlayableAudio(pcm, 'audio/mp3');

    expect(audio).toEqual({ audioBuffer: pcm, mimeType: 'audio/mpeg', extension: 'mp3' });
  });
});
