// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/logger.service.js', () => ({
  logger: { ai: vi.fn() }
}));

process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODELS = 'model-a,model-b';
const { geminiService, GeminiFatalError, toPlayableAudio, buildStoryRequestBody, modelCooldowns, DEFAULT_MODELS, modelsForAge } = await import('../../services/gemini.service.js');
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
    modelCooldowns.clear();
    geminiService.noThinking.clear();
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

  it('should try the next audio model when one rejects the request (400)', async () => {
    const audioBody = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.from([0, 0]).toString('base64') } }] } }] };
    fetch
      .mockResolvedValueOnce(jsonResponse(400, { error: { message: 'Request contains an invalid argument.' } }))
      .mockResolvedValueOnce(jsonResponse(200, audioBody));

    const { value, error } = await run(geminiService.generateAudio('Il était une fois'));

    expect(error).toBeUndefined();
    expect(value.extension).toBe('wav');
    expect(fetch).toHaveBeenCalledTimes(2);
    // The rejecting model is skipped by the next calls
    expect(modelCooldowns.reason(fetch.mock.calls[0][0].match(/models\/([^:]+):/)[1])).toBe('invalid request');
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

  it('should give a whole week in one answer a longer timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    fetch.mockResolvedValue(jsonResponse(200, storyBody('{"stories":[]}')));

    await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Toute la semaine' }));
    await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([240000, 120000]);
    timeout.mockRestore();
  });

  it('should flag a truncated answer and send a bigger budget for a week', async () => {
    fetch.mockResolvedValue(jsonResponse(200, storyBody('Début...', 'MAX_TOKENS')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Toute la semaine' }));

    expect(value.truncated).toBe(true);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.generationConfig.maxOutputTokens).toBe(32768);
  });

  it('should skip a saturated model after one retry, also on the next call', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'high demand' } }))
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'high demand' } }))
      .mockResolvedValue(jsonResponse(200, storyBody('Histoire')));

    const first = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));
    expect(first.value.model).toBe('model-b');
    expect(first.value.skipped).toEqual([{ model: 'model-a', reason: '503' }]);
    expect(fetch).toHaveBeenCalledTimes(3);

    const second = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Mardi' }));
    expect(second.value.model).toBe('model-b');
    expect(second.value.skipped).toEqual([{ model: 'model-a', reason: 'skipped (overloaded)' }]);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('should skip a model whose daily quota is exhausted', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'Quota exceeded for metric generate_content_free_tier_requests, limit: 20', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } }))
      .mockResolvedValue(jsonResponse(200, storyBody('Histoire')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(value.model).toBe('model-b');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(modelCooldowns.reason('model-a')).toBe('daily quota');
  });

  it('should wait the short delay suggested on a per-minute rate limit', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'rate', details: [{ retryDelay: '5s' }] } }))
      .mockResolvedValue(jsonResponse(200, storyBody('Histoire')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(value.model).toBe('model-a');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should skip a model that timed out', async () => {
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    fetch.mockRejectedValueOnce(timeout).mockResolvedValue(jsonResponse(200, storyBody('Histoire')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(value.model).toBe('model-b');
    expect(modelCooldowns.reason('model-a')).toBe('timeout');
  });

  it('should call a model again without thinking config when it rejects it', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse(400, { error: { message: 'Thinking level is not supported for this model.' } }))
      .mockResolvedValue(jsonResponse(200, storyBody('Histoire')));

    const { value } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(value.model).toBe('model-a');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(geminiService.noThinking.has('model-a')).toBe(true);
  });

  it('should refuse a blocked answer', async () => {
    fetch.mockResolvedValue(jsonResponse(200, storyBody('', 'SAFETY')));

    const { error } = await run(geminiService.generateStory({ theme: 'Pluie', age: '4-6', day: 'Lundi' }));

    expect(error.message).toContain('SAFETY');
  });
});

describe('modelsForAge', () => {
  it('should put the Flash models first for teenagers, keeping the configured order otherwise', () => {
    const ordered = modelsForAge(DEFAULT_MODELS, '16-18 ans');
    expect(ordered.slice(0, 6)).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash']);
    expect(ordered.slice(6)).toEqual(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it']);
    expect(modelsForAge(DEFAULT_MODELS, '13-15')[0]).toBe('gemini-3.8-flash');

    expect(modelsForAge(DEFAULT_MODELS, '4-6')).toEqual(DEFAULT_MODELS);
    expect(modelsForAge(['model-a', 'model-b'], '16-18')).toEqual(['model-a', 'model-b']);
  });
});

describe('default models', () => {
  it('should try Flash Lite, then Flash, then Gemma', () => {
    const indexes = (test) => DEFAULT_MODELS.map((model, index) => (test(model) ? index : -1)).filter(index => index >= 0);
    const lite = indexes(model => model.endsWith('flash-lite'));
    const flash = indexes(model => /flash(-preview)?$/.test(model));
    const gemma = indexes(model => model.startsWith('gemma-'));
    expect(Math.max(...lite)).toBeLessThan(Math.min(...flash));
    expect(Math.max(...flash)).toBeLessThan(Math.min(...gemma));
  });
});

describe('buildStoryRequestBody', () => {
  it('should require exactly 7 stories for a whole week, and no count otherwise', () => {
    const week = buildStoryRequestBody('gemini-3.5-flash-lite', 'S', 'P', 32768, { storyCount: 7 }).generationConfig.responseSchema;
    expect(week.properties.stories.minItems).toBe(7);
    expect(week.properties.stories.maxItems).toBe(7);

    const day = buildStoryRequestBody('gemini-3.5-flash-lite', 'S', 'P', 8192).generationConfig.responseSchema;
    expect(day.properties.stories.minItems).toBeUndefined();
    // 2 or 3 tags per story
    expect(day.properties.stories.items.properties.themes).toMatchObject({ minItems: 2, maxItems: 3 });
  });

  it('should require the paragraphs of the age group, and the week context on the first day', () => {
    const body = buildStoryRequestBody('gemini-3.5-flash-lite', 'S', 'P', 8192, { minParagraphs: 5, withWeekPlan: true });
    const schema = body.generationConfig.responseSchema;
    expect(schema.properties.stories.items.properties.paragraphs.minItems).toBe(5);
    expect(schema.required).toEqual(['week_plan', 'characters', 'stories']);
    expect(schema.propertyOrdering).toEqual(['week_plan', 'characters', 'stories']);

    const plain = buildStoryRequestBody('gemini-3.5-flash-lite', 'S', 'P', 8192).generationConfig.responseSchema;
    expect(plain.properties.stories.items.properties.paragraphs.minItems).toBeUndefined();
    expect(plain.properties.characters).toBeUndefined();
  });

  it('should keep thinking low for storytelling, per model family', () => {
    expect(buildStoryRequestBody('gemini-3.8-flash', 'S', 'P', 8192).generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(buildStoryRequestBody('gemini-2.5-flash', 'S', 'P', 8192).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(buildStoryRequestBody('gemma-4-31b-it', 'S', 'P', 8192).generationConfig.thinkingConfig).toBeUndefined();
    expect(buildStoryRequestBody('gemini-3.8-flash', 'S', 'P', 8192, { thinking: false }).generationConfig.thinkingConfig).toBeUndefined();
  });

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
