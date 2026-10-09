// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** In-memory replacement of the jobs repository, plus the stories it knows. */
const mem = vi.hoisted(() => {
  const state = { jobs: new Map(), units: new Map(), stories: [] };
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
    async jobStoryIds(jobId) { return state.stories.filter(s => s.generation_job_id === jobId).map(s => s.id); },
    async recentTitles({ ageGroup }) { return state.stories.filter(s => s.age_group === ageGroup).map(s => s.title).reverse(); }
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
    setReviewStatus: vi.fn(async (ids) => ids.length),
    delete: vi.fn()
  }
}));

const { storyService } = await import('../../services/story.service.js');
const { themeService } = await import('../../services/theme.service.js');
const { generationJobService, normalizeJobParams } = await import('../../services/generation_job.service.js');
const { GenerationWorker } = await import('../../services/generation_worker.js');

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

  it('stops between two days when paused, then resumes at the next missing day', async () => {
    let calls = 0;
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
    mem.state.stories = DAYS.filter(day => day !== 'Jeudi').map((day, i) => ({
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
