// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** In-memory replacement of the jobs repository, plus the stories it knows. */
const mem = vi.hoisted(() => {
  const state = { jobs: new Map(), units: new Map(), stories: [], sheets: new Map() };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const repo = {
    now: () => '2026-10-09 12:00:00',
    async insertJob({ id, params, provider, model, units }) {
      state.jobs.set(id, { id, status: 'queued', params, provider, model, log: [], totalUnits: units.length, doneUnits: 0, createdCount: 0, failedCount: 0, skippedCount: 0, startedAt: null, createdAt: String(state.jobs.size) });
      for (const u of units) state.units.set(u.id, { ...u, jobId: id, context: null, storyIds: [], attempts: 0, model: null });
    },
    async getJob(id) { return state.jobs.has(id) ? clone(state.jobs.get(id)) : null; },
    async listJobs() { return [...state.jobs.values()].map(clone); },
    async updateJob(id, changes) { Object.assign(state.jobs.get(id), clone(changes)); },
    async getUnits(jobId) { return [...state.units.values()].filter(u => u.jobId === jobId).sort((a, b) => a.position - b.position).map(clone); },
    async updateUnit(id, changes) { Object.assign(state.units.get(id), clone(changes)); },
    async nextQueuedJob() { return clone([...state.jobs.values()].find(j => j.status === 'queued') || null); },
    async requeueInterrupted() {
      let n = 0;
      for (const u of state.units.values()) if (u.status === 'running') u.status = 'pending';
      for (const j of state.jobs.values()) if (j.status === 'running') { j.status = 'queued'; n++; }
      return n;
    },
    async existingStories(week, age) {
      return state.stories.filter(s => s.week_number === week && s.age_group === age).sort((a, b) => a.day_order - b.day_order);
    },
    async coverage() { return []; },
    async deleteJob(id) {
      state.jobs.delete(id);
      for (const [unitId, unit] of state.units) if (unit.jobId === id) state.units.delete(unitId);
    },
    async jobStoryIds(jobId) { return state.stories.filter(s => s.generation_job_id === jobId).map(s => s.id); },
    async recentTitles({ ageGroup }) { return state.stories.filter(s => s.age_group === ageGroup).map(s => s.title).reverse(); },
    async titlesToAvoid({ ageGroup }) { return state.stories.filter(s => s.age_group === ageGroup).map(s => s.title).reverse(); },
    async seriesNames() { return ['Antonin', 'Léonie']; },
    async seriesSheet(name) { return state.sheets.get(name) || ''; },
    async saveSeriesSheet(name, sheet) { if (!state.sheets.get(name)) state.sheets.set(name, sheet); }
  };
  return { state, repo };
});

vi.mock('../../config/database.js', () => ({ query: vi.fn(), getConnection: vi.fn() }));
vi.mock('../../services/generation_job.repository.js', () => ({ generationJobRepository: mem.repo }));
vi.mock('../../services/weeklyTheme.service.js', () => ({
  weeklyThemeService: {
    findAll: vi.fn(async () => [{ week_number: 1, theme_name: 'Les volcans' }, { week_number: 2, theme_name: 'La pluie' }]),
    findByWeek: vi.fn(async (week) => (week <= 2 ? { week_number: week, theme_name: week === 1 ? 'Les volcans' : 'La pluie', theme_description: '' } : null))
  }
}));
vi.mock('../../services/theme.service.js', () => ({
  themeService: {
    findAll: vi.fn(async () => [{ id: 't-volcan', name: 'Volcans' }]),
    create: vi.fn(async ({ name }) => ({ theme: { id: `t-${name}`, name }, existing: false }))
  }
}));
vi.mock('../../services/story.service.js', () => ({
  storyService: {
    generateFromAI: vi.fn(),
    create: vi.fn(),
    update: vi.fn(async (id, data) => ({ id, ...data, review_status: 'to_review' })),
    setReviewStatus: vi.fn(async (ids) => ids.length),
    delete: vi.fn()
  }
}));

// Bible of the framed generation (only read by framed jobs)
const castMock = vi.hoisted(() => ({
  cast: {
    id: 'cast1', seriesId: 'ser1', name: 'Famille Martin', ageGroups: ['4-6', '16-18'], universe: 'Un village au bord de la mer', rules: [], referenceWeek: 1,
    characters: [{ key: 'leo', name: 'Léo', role: 'main', age: 5, birthday: null, physical: { hair: 'bruns' }, relations: [] }]
  }
}));
vi.mock('../../services/series_cast.service.js', () => ({
  seriesCastService: {
    get: vi.fn(async (id) => {
      if (id !== 'cast1') throw new Error('Cast not found');
      return JSON.parse(JSON.stringify(castMock.cast));
    }),
    seriesName: vi.fn(async () => 'Les Martin'),
    factsBefore: vi.fn(async () => [{ weekNumber: 1, text: 'Ils ont adopté un chat, Pompon.' }]),
    recapsBefore: vi.fn(async () => [{ weekNumber: 1, recap: 'Léo a découvert un volcan.' }]),
    getRecap: vi.fn(async () => null)
  }
}));
vi.mock('../../services/series_audit.service.js', () => ({
  seriesAuditService: {
    auditStoredWeek: vi.fn(async ({ useAI, beforeRequest }) => {
      if (useAI) await beforeRequest?.();
      return { status: useAI ? 'done' : 'local', issues: [{ severity: 'high' }], recap: 'Résumé', newFacts: ['Un fait'], stale: 0 };
    })
  }
}));

const { storyService } = await import('../../services/story.service.js');
const { themeService } = await import('../../services/theme.service.js');
const { generationJobService, normalizeJobParams, scheduleOf } = await import('../../services/generation_job.service.js');
const { GenerationWorker, isDailyQuotaError } = await import('../../services/generation_worker.js');
const { aiUsageService } = await import('../../services/ai_usage.service.js');
const { seriesAuditService } = await import('../../services/series_audit.service.js');
const { seriesCastService } = await import('../../services/series_cast.service.js');

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const ORDER = Object.fromEntries(DAYS.map((d, i) => [d, i + 1]));
const story = (day, extra = {}) => ({ day, title: `Histoire ${day}`, summary: `Résumé ${day}`, paragraphs: [`Début ${day}.`, `Fin ${day}.`], themes: [{ name: 'Volcan' }], illustration_prompt: 'Un volcan', ...extra });

let storyCounter = 0;
const worker = new GenerationWorker({ sleep: async () => {}, minIntervalMs: 0 });

const createJob = async (input) => {
  // Created jobs must not start on their own: the test drives the worker
  generationJobService.onQueued = () => {};
  return generationJobService.create({ provider: 'gemini', day: 'Toute la semaine', ...input });
};

beforeEach(() => {
  mem.state.jobs.clear();
  mem.state.units.clear();
  mem.state.stories = [];
  mem.state.sheets.clear();
  storyCounter = 0;
  vi.clearAllMocks();
  storyService.create.mockImplementation(async (data) => {
    const id = `s${++storyCounter}`;
    mem.state.stories.push({ id, week_number: data.weekNumber, age_group: data.ageGroup, day_order: ORDER[Object.keys(ORDER).find(d => ({ Lundi: 'Monday', Mardi: 'Tuesday', Mercredi: 'Wednesday', Jeudi: 'Thursday', Vendredi: 'Friday', Samedi: 'Saturday', Dimanche: 'Sunday' })[d] === data.dayOfWeek)], title: data.title, content: data.content, summary: data.summary ?? null, generation_job_id: data.generationJobId });
    return { id };
  });
});

describe('generation job parameters', () => {
  it('normalizes and validates', () => {
    expect(normalizeJobParams({ weeks: ['2', 1, 1, 99], ages: ['7-9', '4-6', 'x'], provider: 'local' }))
      .toMatchObject({ weeks: [1, 2], ages: ['4-6', '7-9'], day: 'Toute la semaine', provider: 'local', skipExisting: true });
    expect(() => normalizeJobParams({ weeks: [], ages: ['4-6'] })).toThrow('week');
    expect(() => normalizeJobParams({ weeks: [1], ages: ['4-6'], day: 'Funday' })).toThrow('day');
  });

  it('estimates requests, skips weeks without topic and cells already written', async () => {
    mem.state.stories = DAYS.map((d, i) => ({ id: `old${i}`, week_number: 1, age_group: '4-6', day_order: i + 1 }));

    const estimate = await generationJobService.estimate({ weeks: [1, 2, 3], ages: ['4-6', '16-18'], provider: 'gemini' });

    // week 1 / 4-6 written, week 3 has no topic (2 cells); remaining: w1 16-18 (7), w2 4-6 (1), w2 16-18 (7)
    expect(estimate).toMatchObject({ units: 6, skipped: 3, toGenerate: 3, missingTopics: [3], requests: 15, quotaWarning: false });
  });

  it('warns when the job needs more requests than the fast models have left today', async () => {
    const remaining = vi.spyOn(aiUsageService, 'remainingToday');

    // Real case of October 10: Flash spent (20 a day each), Flash Lite plenty. 16-18 is written by Flash: 14 requests
    remaining.mockResolvedValueOnce(3).mockResolvedValueOnce(1000);
    const short = await generationJobService.estimate({ weeks: [1, 2], ages: ['4-6', '16-18'], provider: 'gemini' });
    expect(short).toMatchObject({
      requests: 16, remainingRequests: 1003, quotaWarning: true,
      quota: { flash: { requests: 14, remaining: 3 }, lite: { requests: 2, remaining: 1000 }, flashShortfall: true }
    });
    // Each family on its own models; Gemma (slow, last resort) is not counted
    const [flashModels, liteModels] = remaining.mock.calls.map(call => call[0]);
    expect(flashModels.every(model => /-flash(-preview)?$/.test(model))).toBe(true);
    expect(liteModels.every(model => model.endsWith('flash-lite'))).toBe(true);
    expect([...flashModels, ...liteModels].some(model => model.startsWith('gemma-'))).toBe(false);

    remaining.mockResolvedValueOnce(100).mockResolvedValueOnce(500);
    const enough = await generationJobService.estimate({ weeks: [1, 2], ages: ['4-6', '16-18'], provider: 'gemini' });
    expect(enough).toMatchObject({ remainingRequests: 600, quotaWarning: false, quota: { flashShortfall: false } });

    // flashOnly: every age on Flash, 2.5 Flash left out; a chosen model is counted alone
    remaining.mockResolvedValueOnce(100).mockResolvedValueOnce(500);
    const flashOnly = await generationJobService.estimate({ weeks: [1], ages: ['4-6'], provider: 'gemini', flashOnly: true });
    expect(flashOnly.quota.flash.requests).toBe(1);
    expect(remaining.mock.calls.at(-2)[0]).not.toContain('gemini-2.5-flash');
    remaining.mockResolvedValueOnce(2);
    expect(await generationJobService.estimate({ weeks: [1], ages: ['16-18'], provider: 'gemini', model: 'gemini-3-flash-preview' }))
      .toMatchObject({ requests: 7, remainingRequests: 2, quotaWarning: true, quota: null });

    remaining.mockRestore();
  });
});

describe('generation worker', () => {
  it('writes a young week in one request, with the stories linked to the job', async () => {
    storyService.generateFromAI.mockResolvedValue({ model: 'm1', stories: DAYS.map(d => story(d)) });
    const job = await createJob({ weeks: [1], ages: ['4-6'] });

    await worker.kick();

    const done = await generationJobService.get(job.id);
    expect(done).toMatchObject({ status: 'done', createdCount: 7, failedCount: 0 });
    expect(done.units[0]).toMatchObject({ status: 'done', model: 'm1' });
    expect(storyService.generateFromAI).toHaveBeenCalledTimes(1);
    expect(storyService.generateFromAI.mock.calls[0][0]).toMatchObject({ theme: 'Les volcans', day: 'Toute la semaine', age: '4-6' });
    expect(storyService.create.mock.calls[0][0]).toMatchObject({ dayOfWeek: 'Monday', generationJobId: job.id, source: 'gemini', content: '<p>Début Lundi.</p><p>Fin Lundi.</p>' });
    // "Volcan" reuses the similar existing theme "Volcans"
    expect(storyService.create.mock.calls[0][0].themes).toEqual([{ id: 't-volcan', isPrimary: true }]);
    expect(themeService.create).not.toHaveBeenCalled();
  });

  it('writes an older week day by day, each day knowing the previous ones', async () => {
    storyService.generateFromAI.mockImplementation(async (req) => ({ model: 'm1', stories: [story(req.day)], weekPlan: req.day === 'Lundi' ? ['plan'] : null }));
    const job = await createJob({ weeks: [1], ages: ['16-18'] });

    await worker.kick();

    expect(storyService.generateFromAI).toHaveBeenCalledTimes(7);
    const wednesday = storyService.generateFromAI.mock.calls[2][0];
    expect(wednesday).toMatchObject({ day: 'Mercredi', weekSeries: true, weekPlan: ['plan'], previousEnding: 'Fin Mardi.' });
    expect(wednesday.previousDays.map(d => d.day)).toEqual(['Lundi', 'Mardi']);
    expect((await generationJobService.get(job.id)).createdCount).toBe(7);
  });

  it('keeps the series cast, the reserved names and the days already written (content audit fixes)', async () => {
    storyService.generateFromAI.mockImplementation(async (req) => ({
      model: 'm1',
      stories: req.day === 'Toute la semaine' ? DAYS.map(d => story(d)) : [story(req.day)],
      characters: [{ name: 'Antonin', description: 'garçon de 3 ans, cheveux bruns' }],
      // The 2nd try still had a title already used on Monday
      defects: req.day === 'Toute la semaine' ? [{ index: 0, code: 'used-title', detail: 'Histoire Lundi', blocking: false }] : []
    }));
    const first = await createJob({ weeks: [1], ages: ['2-3'], seriesName: 'Antonin', charNames: 'Antonin' });
    await worker.kick();

    const week1 = storyService.generateFromAI.mock.calls[0][0];
    expect(week1.reservedNames).toEqual(['Antonin', 'Léonie']);
    expect(week1.seriesSheet).toBeUndefined();
    expect(mem.state.sheets.get('Antonin')).toBe('Antonin : garçon de 3 ans, cheveux bruns');
    const log = (await generationJobService.get(first.id)).log.map(entry => entry.message).join('\n');
    expect(log).toContain('Lundi to check: used-title (Histoire Lundi)');

    // The next week of the series gets the sheet of the first one
    await createJob({ weeks: [2], ages: ['2-3'], seriesName: 'Antonin', charNames: 'Antonin' });
    await worker.kick();
    expect(storyService.generateFromAI.mock.calls[1][0].seriesSheet).toBe('Antonin : garçon de 3 ans, cheveux bruns');

    // Day by day: each new day knows the texts already written, so it cannot copy one
    storyService.generateFromAI.mockClear();
    await createJob({ weeks: [1], ages: ['16-18'] });
    await worker.kick();
    const wednesday = storyService.generateFromAI.mock.calls[2][0];
    expect(wednesday.previousTexts).toEqual(['Début Lundi. Fin Lundi.', 'Début Mardi. Fin Mardi.']);
    expect(wednesday.previousDays[0]).not.toHaveProperty('text');
  });

  it('regenerates a week in place: same stories, new text, back to review', async () => {
    mem.state.stories = DAYS.map((d, i) => ({ id: `old${i}`, week_number: 1, age_group: '4-6', day_order: i + 1, title: `Ancien ${d}`, content: `<p>Ancien ${d}.</p>`, series_name: null }));
    storyService.generateFromAI.mockResolvedValue({ model: 'm1', stories: DAYS.map(d => story(d)) });

    // A normal job would skip this written week; a regeneration rewrites it
    const estimate = await generationJobService.estimate({ weeks: [1], ages: ['4-6'], provider: 'gemini', regenerate: true });
    expect(estimate).toMatchObject({ toGenerate: 1, requests: 1 });
    const job = await createJob({ weeks: [1], ages: ['4-6'], regenerate: true });
    await worker.kick();

    expect(storyService.generateFromAI).toHaveBeenCalledTimes(1);
    expect(storyService.create).not.toHaveBeenCalled();
    expect(storyService.update).toHaveBeenCalledTimes(7);
    expect(storyService.update.mock.calls[2]).toEqual(['old2', expect.objectContaining({ title: 'Histoire Mercredi', content: '<p>Début Mercredi.</p><p>Fin Mercredi.</p>', summary: 'Résumé Mercredi' }), { regenerated: true }]);
    const done = await generationJobService.get(job.id);
    expect(done.units[0]).toMatchObject({ status: 'done', storyIds: DAYS.map((_, i) => `old${i}`) });
  });

  it('regenerates only the days asked, the others being the context', async () => {
    mem.state.stories = DAYS.map((d, i) => ({ id: `old${i}`, week_number: 1, age_group: '2-3', day_order: i + 1, title: `T ${d}`, content: `<p>Texte de ${d}.</p>`, summary: `R ${d}`, series_name: 'Antonin' }));
    storyService.generateFromAI.mockImplementation(async (req) => ({ model: 'm1', stories: [story(req.day)] }));

    await createJob({ weeks: [1], ages: ['2-3'], seriesName: 'Antonin', regenerate: true, regenerateDays: ['Mercredi'] });
    await worker.kick();

    expect(storyService.generateFromAI).toHaveBeenCalledTimes(1);
    const wednesday = storyService.generateFromAI.mock.calls[0][0];
    expect(wednesday).toMatchObject({ day: 'Mercredi', weekSeries: true, previousEnding: 'Texte de Mardi.' });
    expect(wednesday.previousDays.map(d => d.day)).toEqual(['Lundi', 'Mardi']);
    expect(wednesday.previousTexts).toContain('Texte de Lundi.');
    expect(wednesday.previousTexts).not.toContain('Texte de Mercredi.');
    expect(storyService.update).toHaveBeenCalledTimes(1);
    expect(storyService.update.mock.calls[0][0]).toBe('old2');

    // Other series of the cell and weeks without stories: nothing to regenerate
    await expect(createJob({ weeks: [1], ages: ['2-3'], seriesName: 'Léonie', regenerate: true })).rejects.toThrow('Nothing to regenerate');
    expect(() => normalizeJobParams({ weeks: [1], ages: ['2-3'], day: 'Lundi', regenerate: true })).toThrow('whole weeks');
  });

  it('stops between two days when paused, then resumes at the next missing day', async () => {
    let calls = 0;
    // oxlint-disable-next-line prefer-const -- read by the mock below, assigned once the job exists
    let jobId;
    storyService.generateFromAI.mockImplementation(async (req) => {
      calls++;
      // Paused while Wednesday is being written
      if (req.day === 'Mercredi') await generationJobService.pause(jobId);
      return { stories: [story(req.day)] };
    });
    jobId = (await createJob({ weeks: [1], ages: ['16-18'] })).id;

    await worker.kick();
    let job = await generationJobService.get(jobId);
    expect(job.status).toBe('paused');
    expect(job.units[0]).toMatchObject({ status: 'pending' });
    expect(job.units[0].context.days.map(d => d.day)).toEqual(['Lundi', 'Mardi', 'Mercredi']);

    await generationJobService.resume(jobId);
    await worker.kick();
    job = await generationJobService.get(jobId);
    expect(job).toMatchObject({ status: 'done', createdCount: 7 });
    expect(calls).toBe(7);
    // Thursday continues Wednesday after the pause
    expect(storyService.generateFromAI.mock.calls[3][0]).toMatchObject({ day: 'Jeudi', previousEnding: 'Fin Mercredi.' });
  });

  it('resumes a job interrupted by a server restart', async () => {
    storyService.generateFromAI.mockResolvedValue({ stories: DAYS.map(d => story(d)) });
    const job = await createJob({ weeks: [1], ages: ['4-6'] });
    mem.state.jobs.get(job.id).status = 'running';
    mem.state.units.get(job.units[0].id).status = 'running';

    await worker.resumeAfterRestart();

    expect((await generationJobService.get(job.id)).status).toBe('done');
  });

  it('marks a failed unit, then the retry only writes what is missing', async () => {
    storyService.generateFromAI
      .mockResolvedValueOnce({ stories: DAYS.slice(0, 5).map(d => story(d)) }) // 5 of 7
      .mockImplementation(async (req) => ({ stories: [story(req.day)] }));
    const job = await createJob({ weeks: [1], ages: ['4-6'] });

    await worker.kick();
    let detail = await generationJobService.get(job.id);
    expect(detail).toMatchObject({ status: 'done', createdCount: 5, failedCount: 1 });
    expect(detail.units[0].error).toContain('Only 5 of 7');

    await generationJobService.retryFailed(job.id);
    await worker.kick();
    detail = await generationJobService.get(job.id);
    expect(detail).toMatchObject({ status: 'done', createdCount: 7, failedCount: 0 });
    // The retry asked Samedi and Dimanche only, continuing Vendredi
    expect(storyService.generateFromAI.mock.calls.slice(1).map(([req]) => req.day)).toEqual(['Samedi', 'Dimanche']);
    expect(storyService.generateFromAI.mock.calls[1][0].previousEnding).toBe('Fin Vendredi.');
  });

  it('keeps going after an AI error and cancels between units', async () => {
    // oxlint-disable-next-line prefer-const -- read by the mock below, assigned once the job exists
    let jobId;
    storyService.generateFromAI
      .mockRejectedValueOnce(new Error('All Gemini/Gemma models failed'))
      .mockImplementation(async () => {
        await generationJobService.cancel(jobId);
        return { stories: DAYS.map(d => story(d)) };
      });
    jobId = (await createJob({ weeks: [1, 2], ages: ['4-6'] })).id;

    await worker.kick();

    const job = await generationJobService.get(jobId);
    expect(job.status).toBe('cancelled');
    expect(job.units.map(u => u.status)).toEqual(['failed', 'done']);
    expect(job.units[0].error).toContain('All Gemini/Gemma models failed');
  });

  it('validates and deletes the stories of a job', async () => {
    storyService.generateFromAI.mockResolvedValue({ stories: DAYS.map(d => story(d)) });
    const job = await createJob({ weeks: [1], ages: ['4-6'] });
    await worker.kick();

    expect(await generationJobService.validate(job.id)).toEqual({ updated: 7 });
    expect(await generationJobService.deleteStories(job.id)).toEqual({ deleted: 7 });
    expect(storyService.delete).toHaveBeenCalledTimes(7);
  });

  it('saves the AI summary and gives it to the days that complete a partial week', async () => {
    // Monday and Tuesday exist (Tuesday without summary: its first sentence is used)
    mem.state.stories = [
      { id: 'old1', week_number: 1, age_group: '16-18', day_order: 1, title: 'La carte', content: '<p>Léo trouve une carte. Elle brille.</p>', summary: 'Léo trouve une carte au trésor.' },
      { id: 'old2', week_number: 1, age_group: '16-18', day_order: 2, title: 'Le lac', content: '<p>Le pont est cassé. Ils hésitent.</p>', summary: null },
    ];
    storyService.generateFromAI.mockImplementation(async (req) => ({ stories: [story(req.day)] }));
    await createJob({ weeks: [1], ages: ['16-18'] });

    await worker.kick();

    const wednesday = storyService.generateFromAI.mock.calls[0][0];
    expect(wednesday.day).toBe('Mercredi');
    expect(wednesday.previousDays).toEqual([
      { day: 'Lundi', title: 'La carte', summary: 'Léo trouve une carte au trésor.', opening: 'Léo trouve une carte.' },
      { day: 'Mardi', title: 'Le lac', summary: 'Le pont est cassé.', opening: 'Le pont est cassé.' },
    ]);
    expect(storyService.create.mock.calls[0][0].summary).toBe('Résumé Mercredi');
  });

  it('uses only earlier days as context when filling a gap in an existing week', async () => {
    mem.state.stories = DAYS.filter(day => day !== 'Jeudi').map((day) => ({
      id: `old-${day}`,
      week_number: 1,
      age_group: '4-6',
      day_order: ORDER[day],
      title: `Histoire ${day}`,
      content: `<p>Début ${day}.</p><p>Fin ${day}.</p>`,
      summary: `Résumé ${day}`
    }));
    storyService.generateFromAI.mockImplementation(async req => ({ stories: [story(req.day)] }));
    const job = await createJob({ weeks: [1], ages: ['4-6'] });

    await worker.kick();

    expect(storyService.generateFromAI).toHaveBeenCalledTimes(1);
    expect(storyService.generateFromAI.mock.calls[0][0]).toMatchObject({
      day: 'Jeudi',
      previousDays: [
        { day: 'Lundi', summary: 'Résumé Lundi' },
        { day: 'Mardi', summary: 'Résumé Mardi' },
        { day: 'Mercredi', summary: 'Résumé Mercredi' }
      ],
      previousEnding: 'Fin Mercredi.'
    });
    expect((await generationJobService.get(job.id)).status).toBe('done');
  });

  it('paces every request through the service hook, the length retry included', async () => {
    const sleep = vi.fn(async () => {});
    const paced = new GenerationWorker({ sleep, minIntervalMs: 60000 });
    storyService.generateFromAI.mockImplementation(async (req, provider, { beforeRequest }) => {
      await beforeRequest(); // first request
      await beforeRequest(); // length retry
      return { stories: DAYS.map(d => story(d)) };
    });
    await createJob({ weeks: [1], ages: ['4-6'] });

    await paced.kick();

    // The retry waits for the interval after the first request
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0][0]).toBeGreaterThan(59000);
  });

  it('reports short stories in the job log', async () => {
    storyService.generateFromAI.mockResolvedValue({ stories: DAYS.map(d => story(d)), targetWords: { min: 300, max: 450 } });
    const job = await createJob({ weeks: [1], ages: ['4-6'] });

    await worker.kick();

    const { log } = await generationJobService.get(job.id);
    expect(log.map(l => l.message).join(' ')).toContain('Lundi short: 4 words / 300 minimum');
  });

  it('drops vague tags, reports long stories and gives the titles already used', async () => {
    mem.state.stories = [{ id: 'old', week_number: 9, age_group: '4-6', day_order: 1, title: 'Le festin des oiseaux', content: '<p>x</p>' }];
    storyService.generateFromAI.mockResolvedValue({
      stories: DAYS.map(d => story(d, { themes: [{ name: 'Curiosité' }, { name: 'Champignons' }], paragraphs: [Array.from({ length: 800 }, () => 'mot').join(' ')] })),
      targetWords: { min: 300, max: 450 }
    });
    const job = await createJob({ weeks: [1], ages: ['4-6'] });

    await worker.kick();

    expect(storyService.generateFromAI.mock.calls[0][0].avoidTitles).toEqual(['Le festin des oiseaux']);
    expect(themeService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Champignons' }));
    expect(themeService.create).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'Curiosité' }));
    const { log } = await generationJobService.get(job.id);
    expect(log.map(l => l.message).join(' ')).toContain('Lundi long: 800 words / 450 maximum');
  });

  it('refuses a job with nothing to generate', async () => {
    await expect(createJob({ weeks: [3], ages: ['4-6'] })).rejects.toThrow('Nothing to generate');
  });
});

describe('framed generation (series bible)', () => {
  /** The mocked AI calls the pacing hook, as the real story service does before every request. */
  const answerWith = (extra = {}) => storyService.generateFromAI.mockImplementation(async (req, provider, options) => {
    await options?.beforeRequest?.();
    return { model: 'm1', stories: req.day === 'Toute la semaine' ? DAYS.map(d => story(d)) : [story(req.day)], ...extra };
  });

  it('needs a cast, drops the free character settings and checks the age groups of the cast', async () => {
    expect(() => normalizeJobParams({ weeks: [1], ages: ['4-6'], mode: 'framed' })).toThrow('cast');
    expect(normalizeJobParams({ weeks: [1], ages: ['4-6'], mode: 'framed', castId: 'cast1', numCharacters: 3, charNames: 'Zoé' }))
      .toMatchObject({ mode: 'framed', castId: 'cast1', numCharacters: null, charNames: '', audit: true, dailyBudget: null });
    expect(() => normalizeJobParams({ weeks: [1], ages: ['4-6'], mode: 'framed', castId: 'cast1', dailyBudget: -2 })).toThrow('budget');
    // The free parameters keep their exact shape
    expect(normalizeJobParams({ weeks: [1], ages: ['4-6'] })).not.toHaveProperty('mode');

    await expect(createJob({ weeks: [1], ages: ['7-9'], mode: 'framed', castId: 'cast1' })).rejects.toThrow('7-9');
  });

  it('writes with the bible of the week, never the automatic sheet', async () => {
    answerWith({ characters: [{ name: 'Intrus', description: 'inventé' }] });
    const job = await createJob({ weeks: [2], ages: ['4-6'], mode: 'framed', castId: 'cast1', audit: false });
    await worker.kick();

    const request = storyService.generateFromAI.mock.calls[0][0];
    expect(request).toMatchObject({ seriesName: 'Les Martin', castFacts: [{ text: 'Ils ont adopté un chat, Pompon.' }], castRecaps: [{ weekNumber: 1 }] });
    expect(request.cast.characters[0]).toMatchObject({ name: 'Léo', currentAge: 5, birthdayThisWeek: false });
    expect(request.seriesSheet).toBeUndefined();
    expect(mem.state.sheets.size).toBe(0);
    expect(storyService.create.mock.calls[0][0]).toMatchObject({ seriesName: 'Les Martin' });
    expect((await generationJobService.get(job.id)).status).toBe('done');
  });

  it('leaves the free requests without any bible', async () => {
    answerWith();
    await createJob({ weeks: [1], ages: ['4-6'] });
    await worker.kick();
    const request = storyService.generateFromAI.mock.calls[0][0];
    expect(request).not.toHaveProperty('cast');
    expect(request).not.toHaveProperty('castFacts');
  });

  it('counts as written only the stories of its series', async () => {
    mem.state.stories = DAYS.map((d, i) => ({ id: `free${i}`, week_number: 1, age_group: '4-6', day_order: i + 1, series_name: null }));
    expect((await generationJobService.estimate({ weeks: [1], ages: ['4-6'], provider: 'local' })).skipped).toBe(1);
    // Framed, with the audit of the week: 1 request for the week + 1 for its audit
    expect(await generationJobService.estimate({ weeks: [1], ages: ['4-6'], provider: 'local', mode: 'framed', castId: 'cast1' }))
      .toMatchObject({ skipped: 0, requests: 8 });
  });

  it('waits for the next quota day instead of failing, then resumes at the missing day', async () => {
    const remaining = vi.spyOn(aiUsageService, 'remainingToday');
    remaining.mockResolvedValueOnce(5).mockResolvedValueOnce(5).mockResolvedValueOnce(5).mockResolvedValue(0);
    answerWith();
    const job = await createJob({ weeks: [1], ages: ['16-18'], mode: 'framed', castId: 'cast1', audit: false });
    await worker.kick();

    const waiting = await generationJobService.get(job.id);
    expect(waiting).toMatchObject({ status: 'scheduled', failedCount: 0 });
    expect(waiting.resumeAt).toBeTruthy();
    expect(waiting.units[0]).toMatchObject({ status: 'pending' });
    expect(waiting.units[0].storyIds).toHaveLength(3);
    expect(waiting.log.map(l => l.message).join(' ')).toContain('no quota left today: scheduled');

    remaining.mockResolvedValue(100);
    await generationJobService.resume(job.id);
    await worker.kick();
    const done = await generationJobService.get(job.id);
    expect(done).toMatchObject({ status: 'done', createdCount: 7 });
    expect(storyService.generateFromAI.mock.calls.at(-1)[0].day).toBe('Dimanche');
    remaining.mockRestore();
  });

  it('keeps to its daily budget', async () => {
    answerWith();
    const job = await createJob({ weeks: [1], ages: ['16-18'], mode: 'framed', castId: 'cast1', audit: false, dailyBudget: 2 });
    await worker.kick();
    const waiting = await generationJobService.get(job.id);
    expect(waiting).toMatchObject({ status: 'scheduled', budgetUsed: 2 });
    expect(waiting.units[0].storyIds).toHaveLength(2);
  });

  it('turns a daily quota answer into a wait (framed) but keeps it a failure (free)', async () => {
    const quotaError = new Error('All Gemini/Gemma models failed (gemini-3-flash-preview: 429 daily quota, gemini-3.5-flash-lite: skipped (daily quota)).');
    storyService.generateFromAI.mockRejectedValue(quotaError);
    const framed = await createJob({ weeks: [1], ages: ['4-6'], mode: 'framed', castId: 'cast1' });
    await worker.kick();
    expect((await generationJobService.get(framed.id)).status).toBe('scheduled');

    await generationJobService.cancel(framed.id);
    const free = await createJob({ weeks: [2], ages: ['4-6'] });
    await worker.kick();
    expect((await generationJobService.get(free.id)).status).toBe('failed');
  });

  it('reads daily quota failures and plans the quota days', () => {
    expect(isDailyQuotaError('All Gemini/Gemma models failed (a: 429 daily quota, b: skipped (daily quota)).')).toBe(true);
    expect(isDailyQuotaError('All Gemini/Gemma models failed (a: 429 daily quota, b: 503).')).toBe(false);
    expect(isDailyQuotaError('timeout')).toBe(false);

    const models = { flashModels: ['gemini-3-flash-preview'], liteModels: ['gemini-3.5-flash-lite'] };
    // 20 + 500 a day; 30 left today; 100 requests: today, then 1 more day
    expect(scheduleOf(100, 50, { ...models, remainingFlash: 10, remainingLite: 20 })).toEqual({ perDay: 520, today: 30, days: 2 });
    // A budget of 40 a day: 30 today, then 40 a day
    expect(scheduleOf(100, 50, { ...models, remainingFlash: 10, remainingLite: 20, dailyBudget: 40 })).toEqual({ perDay: 40, today: 30, days: 3 });
    expect(scheduleOf(10, 0, { ...models, remainingFlash: null, remainingLite: 5 }).days).toBeNull();
  });
});

describe('framed generation: weekly audit', () => {
  const answer = () => storyService.generateFromAI.mockImplementation(async (req, provider, options) => {
    await options?.beforeRequest?.();
    return { model: 'm1', stories: req.day === 'Toute la semaine' ? DAYS.map(d => story(d)) : [story(req.day)] };
  });

  it('audits each complete week against the bible and logs what it found', async () => {
    answer();
    const job = await createJob({ weeks: [1], ages: ['4-6'], mode: 'framed', castId: 'cast1' });
    await worker.kick();

    expect(seriesAuditService.auditStoredWeek).toHaveBeenCalledWith(expect.objectContaining({
      castId: 'cast1', ageGroup: '4-6', weekNumber: 1, useAI: true, rewritten: false
    }));
    const { log, status } = await generationJobService.get(job.id);
    expect(status).toBe('done');
    expect(log.map(l => l.message).join(' ')).toContain('Week 1 · 4-6: audit done, 1 issue(s) (1 high, 1 fact(s) proposed)');
  });

  it('never audits a free job', async () => {
    answer();
    await createJob({ weeks: [1], ages: ['4-6'] });
    await worker.kick();
    expect(seriesAuditService.auditStoredWeek).not.toHaveBeenCalled();
  });

  it('postpones the audit when the quota is out, and does it first when the job resumes', async () => {
    const remaining = vi.spyOn(aiUsageService, 'remainingToday');
    // The week is written, the audit finds no quota left
    remaining.mockResolvedValueOnce(5).mockResolvedValue(0);
    answer();
    const job = await createJob({ weeks: [1], ages: ['4-6'], mode: 'framed', castId: 'cast1' });
    await worker.kick();

    const waiting = await generationJobService.get(job.id);
    expect(waiting.status).toBe('scheduled');
    expect(waiting.units[0].status).toBe('done');
    expect(waiting.log.map(l => l.message).join(' ')).toContain('audit postponed');

    remaining.mockResolvedValue(100);
    seriesCastService.getRecap.mockResolvedValueOnce({ audit: { status: 'postponed' } });
    await generationJobService.resume(job.id);
    await worker.kick();
    expect(seriesAuditService.auditStoredWeek).toHaveBeenCalledTimes(2);
    expect((await generationJobService.get(job.id)).status).toBe('done');
    remaining.mockRestore();
  });

  it('gives the drifts found by the audit to a regeneration that fixes them', async () => {
    mem.state.stories = DAYS.map((d, i) => ({ id: `old${i}`, week_number: 1, age_group: '4-6', day_order: i + 1, series_name: 'Les Martin', content: '<p>x</p>' }));
    seriesCastService.getRecap.mockResolvedValue({ audit: { issues: [
      { day: 'Mardi', severity: 'high', explanation: 'Léo a 5 ans, pas 7' },
      { day: '', severity: 'low', explanation: 'nuance' }
    ] } });
    answer();
    await createJob({ weeks: [1], ages: ['4-6'], mode: 'framed', castId: 'cast1', regenerate: true, regenerateDays: ['Mardi'], fixDrift: true, audit: false });
    await worker.kick();

    const request = storyService.generateFromAI.mock.calls[0][0];
    expect(request.castDriftNotes).toEqual(['Mardi : Léo a 5 ans, pas 7']);
    expect(seriesAuditService.auditStoredWeek).toHaveBeenCalledWith(expect.objectContaining({ rewritten: true }));
    seriesCastService.getRecap.mockResolvedValue(null);
  });
});

describe('framed generation: quota of the audit', () => {
  it('checks the quota of the audit on its own models (Flash Lite), not on the Flash models of the stories', async () => {
    const remaining = vi.spyOn(aiUsageService, 'remainingToday').mockResolvedValue(100);
    storyService.generateFromAI.mockImplementation(async (req, provider, options) => {
      await options?.beforeRequest?.();
      return { model: 'm1', stories: [story(req.day)] };
    });
    await createJob({ weeks: [1], ages: ['16-18'], mode: 'framed', castId: 'cast1' });
    await worker.kick();

    const [storyModels] = remaining.mock.calls[0];
    const [auditCheck] = remaining.mock.calls.at(-1);
    expect(storyModels.some(model => /-flash(-preview)?$/.test(model))).toBe(true);
    expect(auditCheck.length).toBeGreaterThan(0);
    expect(auditCheck.every(model => model.includes('flash-lite'))).toBe(true);
    remaining.mockRestore();
  });
});

describe('job delete and replay', () => {
  it('deletes a finished job but not a queued one, and keeps its stories', async () => {
    storyService.generateFromAI.mockResolvedValue({ model: 'm1', stories: DAYS.map(d => story(d)) });
    const job = await createJob({ weeks: [1], ages: ['4-6'] });
    await expect(generationJobService.remove(job.id)).rejects.toThrow('Pause or cancel');
    await worker.kick();

    await generationJobService.remove(job.id);
    await expect(generationJobService.get(job.id)).rejects.toThrow('not found');
    expect(mem.state.stories).toHaveLength(7);
  });

  it('replays a job with the same parameters', async () => {
    storyService.generateFromAI.mockResolvedValue({ model: 'm1', stories: DAYS.map(d => story(d)) });
    const job = await createJob({ weeks: [1, 2], ages: ['4-6'], charNames: 'Zoé' });
    await worker.kick();
    mem.state.stories = [];

    const again = await generationJobService.replay(job.id);
    expect(again.id).not.toBe(job.id);
    expect(again.params).toMatchObject({ weeks: [1, 2], ages: ['4-6'], charNames: 'Zoé' });
    expect(again.status).toBe('queued');
  });
});
