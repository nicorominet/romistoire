import { describe, it, expect } from 'vitest';
import { assignWeekDays, cleanStoryParagraphs, isPlaceholderStory, splitParagraphsForAge, countRepetitiveOpenings, openingPattern, removeStutter, extractJson, extractWeekContext, extractWeekPlan, parseStoryOutput, removeRepeatedOpening, splitLongParagraph } from '../../services/helpers/story_output.helper.js';

const story = (overrides = {}) => ({
  day: 'Lundi',
  title: 'La goutte',
  summary: 'Léa suit une goutte.',
  themes: [{ name: 'Nature', description: "Le cycle de l'eau", icon: '💧', color: '#2196F3' }],
  paragraphs: ['Premier.', 'Second.'],
  illustration_prompt: 'Une fille en ciré jaune.',
  ...overrides
});

describe('extractJson', () => {
  it('should ignore code fences and chatter around the JSON', () => {
    const text = 'Voici l\'histoire :\n```json\n{"stories":[{"title":"A } b"}]}\n```\nBonne lecture !';
    expect(JSON.parse(extractJson(text))).toEqual({ stories: [{ title: 'A } b' }] });
  });

  it('should return null for unbalanced JSON', () => {
    expect(extractJson('{"stories": [')).toBeNull();
    expect(extractJson('pas de json')).toBeNull();
  });
});

describe('parseStoryOutput', () => {
  it('should normalize a clean answer', () => {
    const [parsed] = parseStoryOutput(JSON.stringify({ stories: [story()] }));

    expect(parsed).toEqual({
      day: 'Lundi',
      title: 'La goutte',
      summary: 'Léa suit une goutte.',
      themes: [{ name: 'Nature', description: "Le cycle de l'eau", icon: '💧', color: '#2196F3' }],
      paragraphs: ['Premier.', 'Second.'],
      illustrationPrompt: 'Une fille en ciré jaune.',
      cleanedParagraphs: 0
    });
  });

  it('should accept a single object, a bare array or a story without wrapper', () => {
    expect(parseStoryOutput(JSON.stringify({ stories: story() }))).toHaveLength(1);
    expect(parseStoryOutput(JSON.stringify([story(), story({ day: 'Mardi' })]))).toHaveLength(2);
    expect(parseStoryOutput(JSON.stringify(story()))).toHaveLength(1);
  });

  it('should normalize day names written in lowercase or with punctuation', () => {
    const stories = parseStoryOutput(JSON.stringify({ stories: [story({ day: 'mercredi.' }), story({ day: 'Jour inconnu' })] }));
    expect(stories.map(s => s.day)).toEqual(['Mercredi', null]);
  });

  it('should split a "content" string into paragraphs when "paragraphs" is missing', () => {
    const [parsed] = parseStoryOutput(JSON.stringify({ stories: [story({ paragraphs: undefined, content: 'Un.\n\nDeux.' })] }));
    expect(parsed.paragraphs).toEqual(['Un.', 'Deux.']);
  });

  it('should drop invalid themes and colors, and empty stories', () => {
    const stories = parseStoryOutput(JSON.stringify({ stories: [
      story({ themes: [{ name: '' }, { name: 'Amitié', color: 'rouge' }] }),
      story({ paragraphs: [] })
    ] }));

    expect(stories).toHaveLength(1);
    expect(stories[0].themes).toEqual([{ name: 'Amitié', description: '', icon: '', color: undefined }]);
  });

  it('should return null when the answer is not JSON', () => {
    expect(parseStoryOutput('**Titre de l\'Histoire :** La pluie\n\nIl pleut.')).toBeNull();
    expect(parseStoryOutput('{"stories": []}')).toBeNull();
  });
});

describe('extractWeekPlan', () => {
  const days = ['Lundi : Léo trouve une carte', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((d, i) => (i === 0 ? d : `Étape ${i + 1}`));

  it('should read the 7 lines of the plan, without a leading day name', () => {
    const plan = extractWeekPlan(JSON.stringify({ week_plan: days, stories: [] }));
    expect(plan).toHaveLength(7);
    expect(plan[0]).toBe('Léo trouve une carte');
  });

  it('should ignore a missing or incomplete plan', () => {
    expect(extractWeekPlan(JSON.stringify({ stories: [] }))).toBeNull();
    expect(extractWeekPlan(JSON.stringify({ week_plan: days.slice(0, 5), stories: [] }))).toBeNull();
    expect(extractWeekPlan('pas de JSON')).toBeNull();
  });
});

describe('splitLongParagraph', () => {
  it('should split a story written as one block', () => {
    const sentences = Array.from({ length: 9 }, (_, i) => `Phrase numéro ${i + 1} assez longue pour remplir le paragraphe de cette histoire.`);
    const paragraphs = splitLongParagraph(sentences.join(' '));
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toContain('Phrase numéro 1');
    expect(paragraphs[1].startsWith('Phrase numéro 4')).toBe(true);
  });

  it('should prefer line breaks and keep short paragraphs', () => {
    expect(splitLongParagraph('Premier.\nDeuxième.')).toEqual(['Premier.', 'Deuxième.']);
    expect(splitLongParagraph('Court.')).toEqual(['Court.']);
  });

  it('should split a single paragraph of a parsed story', () => {
    const block = Array.from({ length: 10 }, (_, i) => `« Bonjour ${i} ! » dit le faon, qui trottine longuement dans la forêt givrée du matin.`).join(' ');
    const [story] = parseStoryOutput(JSON.stringify({ stories: [{ day: 'Samedi', title: 'T', summary: 'S', themes: [], paragraphs: [block], illustration_prompt: 'I' }] }));
    expect(story.paragraphs.length).toBeGreaterThan(1);
  });
});

describe('isPlaceholderStory', () => {
  it('should spot the filler written to reach 7 stories (real case of week 53)', () => {
    const filler = Array.from({ length: 5 }, () => 'Ceci est un jour fictif pour respecter la structure du JSON.');
    expect(isPlaceholderStory({ title: 'Titre temporaire non utilisé', paragraphs: filler })).toBe(true);
    expect(isPlaceholderStory({ title: 'Le jeudi', paragraphs: filler })).toBe(true);
    // The same sentence repeated, without any telltale word
    expect(isPlaceholderStory({ title: 'T', paragraphs: ['Léonie dort. Léonie dort. Léonie dort. Léonie dort.'] })).toBe(true);
  });

  it('should keep real stories, refrains included', () => {
    expect(isPlaceholderStory({ title: 'La forêt', paragraphs: ['Léonie court dans la forêt. Elle ramasse une châtaigne.', '« Regarde ! » dit Papa. Ils rient.'] })).toBe(false);
    expect(isPlaceholderStory({ title: 'Le refrain', paragraphs: ['Toc toc toc ! Qui est là ? Le vent souffle. Toc toc toc ! Qui est là ? La porte grince. Léonie ouvre.'] })).toBe(false);
  });

  it('should drop a filler story from a parsed week', () => {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const stories = parseStoryOutput(JSON.stringify({ stories: days.map(day => (day === 'Jeudi'
      ? { day, title: 'Titre temporaire non utilisé', summary: '', themes: [], paragraphs: ['Ceci est un jour fictif pour respecter la structure du JSON.'], illustration_prompt: '' }
      : { day, title: `Histoire ${day}`, summary: 'S', themes: [], paragraphs: [`Léonie vit le ${day}.`], illustration_prompt: 'I' })) }));
    expect(stories.map(story => story.day)).toEqual(['Lundi', 'Mardi', 'Mercredi', 'Vendredi', 'Samedi', 'Dimanche']);
  });
});

describe('splitParagraphsForAge', () => {
  const sentence = (i) => `Léonie observe la feuille numéro ${i} qui tombe doucement dans le jardin.`;
  it('should split a block too long for 4-6 into groups of whole sentences', () => {
    const block = Array.from({ length: 9 }, (_, i) => sentence(i)).join(' '); // ~108 words
    const result = splitParagraphsForAge([block], '4-6');
    expect(result.length).toBeGreaterThan(1);
    expect(result.join(' ')).toBe(block);
    result.forEach(paragraph => expect(paragraph.endsWith('.')).toBe(true));
  });

  it('should keep paragraphs within the size of the age', () => {
    const block = Array.from({ length: 9 }, (_, i) => sentence(i)).join(' ');
    expect(splitParagraphsForAge([block], '16-18')).toEqual([block]);
    expect(splitParagraphsForAge(['Court.'], '2-3')).toEqual(['Court.']);
  });
});

describe('extractWeekContext', () => {
  it('should read the plan and the character sheets of the first day', () => {
    const plan = ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept'];
    const context = extractWeekContext(JSON.stringify({
      week_plan: plan,
      characters: [{ name: 'Papouin', description: 'Garçon de 5 ans, cheveux blonds' }, { name: '', description: 'sans nom' }],
      stories: []
    }));
    expect(context.weekPlan).toEqual(plan);
    expect(context.characters).toEqual([{ name: 'Papouin', description: 'Garçon de 5 ans, cheveux blonds' }]);
  });

  it('should return nulls without context', () => {
    expect(extractWeekContext(JSON.stringify({ stories: [] }))).toEqual({ weekPlan: null, characters: null });
  });
});

describe('removeRepeatedOpening', () => {
  const ending = "En attendant de le découvrir dès demain, Papouin ramassa son seau et sa pelle. Il avait hâte de mener l'enquête !";

  it('should drop a first paragraph copied from the previous ending', () => {
    const { paragraphs, removed } = removeRepeatedOpening([ending, 'Ce mardi matin, Papouin revient sur la plage.'], ending);
    expect(paragraphs).toEqual(['Ce mardi matin, Papouin revient sur la plage.']);
    expect(removed).toBe(2);
  });

  it('should keep the new text that follows a copied opening', () => {
    const copied = `${ending} Dès le lendemain matin, il s'installa au bord de l'eau.`;
    const { paragraphs } = removeRepeatedOpening([copied, 'Suite.'], ending);
    expect(paragraphs[0]).toBe("Dès le lendemain matin, il s'installa au bord de l'eau.");
  });

  it('should leave a story that does not repeat the ending', () => {
    const story = ['Ce mardi, Papouin se souvient du mystère d’hier.', 'Suite.'];
    expect(removeRepeatedOpening(story, ending)).toEqual({ paragraphs: story, removed: 0 });
    expect(removeRepeatedOpening(story, '')).toEqual({ paragraphs: story, removed: 0 });
  });
});

describe('cleanStoryParagraphs', () => {
  // Real answers of the Noulopi week (7 October 2026)
  const filler = [
    "Un paragraphe de transition pour atteindre la longueur minimale requise tout en maintenant le rythme narratif de cette conclusion dominicale.",
    "Un autre paragraphe pour enrichir la description de l'ambiance automnale et clore définitivement la réflexion sur la biodiversité forestière.",
    "Le huitième et dernier paragraphe qui scelle la fin de cette belle aventure naturaliste au cœur des bois de septembre."
  ];
  const illustration = "Un adolescent aux cheveux châtains ébouriffés, portant une veste en velours côtelé vert olive, est penché sur un carnet de notes en cuir posé sur une souche dans une forêt de chênes en automne. Il tient un compas.";
  const story = [
    "Noulopi referme son carnet, la tête pleine de questions.",
    "« Encore un paragraphe à écrire dans mon carnet ! » soupire-t-il en riant, avant de reprendre sa marche le long du ruisseau, les yeux rivés sur les branches où les écureuils s'activent déjà pour l'hiver."
  ];

  it('should remove comments about the text', () => {
    expect(cleanStoryParagraphs([...story, ...filler])).toEqual({ paragraphs: story, removed: 3 });
  });

  it('should remove the illustration description copied into the text', () => {
    const copied = `${illustration} Ambiance de fin de journée, style illustration jeunesse semi-réaliste et soignée.`;
    expect(cleanStoryParagraphs([...story, copied], illustration)).toEqual({ paragraphs: story, removed: 1 });
    expect(cleanStoryParagraphs([...story, illustration], illustration).removed).toBe(1);
  });

  it('should keep a normal story and never empty one', () => {
    expect(cleanStoryParagraphs(story, illustration)).toEqual({ paragraphs: story, removed: 0 });
    expect(cleanStoryParagraphs(filler)).toEqual({ paragraphs: filler, removed: 0 });
  });

  it('should be applied when parsing an answer', () => {
    const [parsed] = parseStoryOutput(JSON.stringify({ stories: [{ day: 'Dimanche', title: 'T', summary: 'S', themes: [], paragraphs: [...story, ...filler], illustration_prompt: illustration }] }));
    expect(parsed.paragraphs).toEqual(story);
    expect(parsed.cleanedParagraphs).toBe(3);
  });
});

describe('removeStutter', () => {
  it('should remove a group of words written twice (real Friday sentence)', () => {
    expect(removeStutter('fabriquer des petits bonhommes avec les bogues et les bogues et les branches ramassées dans le jardin'))
      .toEqual({ text: 'fabriquer des petits bonhommes avec les bogues et les branches ramassées dans le jardin', count: 1 });
  });

  it('should keep intended repetitions', () => {
    expect(removeStutter('Il fait très très beau, beau comme un soleil.').count).toBe(0);
    expect(removeStutter('Pas à pas, petit à petit, ils avancent.').count).toBe(0);
  });

  it('should be counted by the paragraph cleaning', () => {
    expect(cleanStoryParagraphs(['Avec les bogues et les bogues et les branches.'])).toEqual({ paragraphs: ['Avec les bogues et les branches.'], removed: 1 });
  });
});

describe('repetitive openings', () => {
  const forbidden = ['Hier', 'La veille', 'Après avoir', 'Alors que'];
  const story = (text) => ({ paragraphs: [text] });

  it('should give the first two words of a story', () => {
    expect(openingPattern('Hier, Léonie et Antonin avaient trouvé une bogue.')).toBe('hier léonie');
    expect(openingPattern('« Regarde ! » cria Léo.')).toBe('regarde cria');
  });

  it('should count forbidden and repeated openings (real week: 6 times "Hier, Léonie et Antonin")', () => {
    const week = [story('Les feuilles des arbres se parent de teintes dorées.'), ...Array.from({ length: 6 }, () => story('Hier, Léonie et Antonin avaient découvert une bogue.'))];
    expect(countRepetitiveOpenings(week, forbidden)).toBe(6);

    const varied = [story('Le vent souffle fort.'), story('« Regarde ! » cria Léo.'), story('Antonin court vers le châtaignier.')];
    expect(countRepetitiveOpenings(varied, forbidden)).toBe(0);
    expect(countRepetitiveOpenings([story('Alors que le soleil se lève, Léo part.')], forbidden)).toBe(1);
  });
});

describe('assignWeekDays', () => {
  const week = (days) => days.map((day, index) => ({ day, title: `T${index}` }));

  it('should give the days by position when a day of a 7-story week is repeated (real Halloween answer)', () => {
    const { stories, fixed } = assignWeekDays(week(['Lundi', 'Mardi', 'Mercredi', 'Mardi', 'Vendredi', 'Samedi', 'Dimanche']));
    expect(stories.map(story => story.day)).toEqual(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']);
    expect(fixed).toBe(1);
  });

  it('should keep a correct week and remove a repeated day from an incomplete one', () => {
    const correct = week(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']);
    expect(assignWeekDays(correct)).toEqual({ stories: correct, fixed: 0 });

    const { stories, fixed } = assignWeekDays(week(['Lundi', 'Mardi', 'Mardi']));
    expect(stories.map(story => story.day)).toEqual(['Lundi', 'Mardi', null]);
    expect(fixed).toBe(1);
  });
});
