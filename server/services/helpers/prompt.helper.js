import { STORY_DAYS } from './story_schema.js';
import { normalizeThemeName } from './theme_name.helper.js';

export const ALL_WEEK = "Toute la semaine";

const KNOWN_AGES = ["2-3", "4-6", "7-9", "10-12", "13-15", "16-18"];
const DEFAULT_AGE = "4-6";

/**
 * Writing profile per age group. Lengths stay within the output budget of a full week (7 stories).
 * Models write about 70 % of a word count and stop at the smallest number of paragraphs allowed
 * (measured on the generation logs): the length is given as a minimum number of developed paragraphs,
 * with the word count it amounts to.
 */
const AGE_PROFILES = {
  "2-3": {
    wordCount: "environ 150-250 mots",
    paragraphs: "6 à 8 paragraphes de 2 à 3 phrases",
    minParagraphs: 6,
    maxParagraphWords: 45,
    storyStyle: "Phrases de 5 à 8 mots, mots concrets du quotidien, répétitions et onomatopées (« plouf », « miam »). Un seul personnage principal, une seule action à la fois, ton doux et rassurant.",
    illustrationStyle: "Style « Livre d'éveil » : formes rondes et simples, couleurs vives et franches, gros plan sur un personnage mignon, fond épuré, aucun détail effrayant."
  },
  "4-6": {
    wordCount: "environ 300-450 mots",
    paragraphs: "7 à 9 paragraphes de 3 à 4 phrases",
    minParagraphs: 7,
    maxParagraphWords: 70,
    storyStyle: "Phrases simples mais variées, vocabulaire concret avec un ou deux mots nouveaux expliqués par le contexte. Dialogues courts, ton enjoué, une petite difficulté résolue grâce à la curiosité ou l'entraide.",
    illustrationStyle: "Style album jeunesse : aquarelle ou gouache douce, personnages expressifs, scène lisible au premier coup d'œil, couleurs chaleureuses."
  },
  "7-9": {
    wordCount: "environ 500-700 mots",
    paragraphs: "9 à 11 paragraphes de 3 à 5 phrases",
    minParagraphs: 9,
    maxParagraphWords: 90,
    storyStyle: "Phrases plus longues et liées, vocabulaire riche mais accessible, dialogues vivants. Une vraie intrigue avec un problème à résoudre ; la notion scientifique sert à le résoudre.",
    illustrationStyle: "Style roman illustré : décor détaillé, textures et lumière travaillées, mouvement dans la scène, palette harmonieuse."
  },
  "10-12": {
    wordCount: "environ 700-900 mots",
    paragraphs: "10 à 12 paragraphes de 4 à 5 phrases",
    minParagraphs: 10,
    maxParagraphWords: 110,
    storyStyle: "Narration plus ambitieuse : descriptions, émotions nuancées, humour, personnages qui doutent et raisonnent. La science est expliquée avec précision (causes, conséquences, ordres de grandeur).",
    illustrationStyle: "Style roman illustré pour grands lecteurs : composition dynamique, éclairage cinématographique, détails réalistes avec une touche d'imaginaire."
  },
  "13-15": {
    wordCount: "environ 900-1100 mots",
    paragraphs: "11 à 13 paragraphes de 4 à 6 phrases",
    minParagraphs: 11,
    maxParagraphWords: 130,
    storyStyle: "Ton « Young Adult » : narration immersive, dialogues naturels, enjeux personnels et questionnements éthiques autour de la science. Vocabulaire scientifique exact, défini quand il apparaît.",
    illustrationStyle: "Style « Young Adult » : illustration semi-réaliste, ambiance travaillée (lumière, météo, profondeur de champ), personnages adolescents crédibles."
  },
  "16-18": {
    wordCount: "environ 1000-1200 mots",
    paragraphs: "12 à 14 paragraphes de 4 à 6 phrases",
    minParagraphs: 12,
    maxParagraphWords: 140,
    storyStyle: "Écriture littéraire pour jeunes adultes, sans édulcorer : réflexion, nuances, démarche scientifique (hypothèse, observation, preuve). Le lecteur est traité en adulte.",
    illustrationStyle: "Style « Young Adult » mature : illustration réaliste ou concept art, composition soignée, ambiance réfléchie, détails scientifiques exacts."
  }
};

const DAY_RULES = {
  Lundi: "Lundi : ouvrir la semaine. Présenter les personnages et le thème, puis terminer par un cliffhanger (suspense ou question) qui donne envie de lire la suite demain.",
  Mardi: "Mardi : approfondir le thème avec une nouvelle découverte, puis terminer par un cliffhanger.",
  Mercredi: "Mercredi : rebondissement au milieu de la semaine, puis terminer par un cliffhanger.",
  Jeudi: "Jeudi : la difficulté atteint son sommet, puis terminer par un cliffhanger.",
  Vendredi: "Vendredi : résoudre l'intrigue de la semaine, puis suggérer subtilement une activité pour le week-end, en lien direct avec le thème (ex. « Et si ce week-end, nous allions observer les papillons dans le jardin ? »).",
  Samedi: "Samedi : histoire douce qui prolonge le thème, avec une idée d'activité pratique à faire en famille. Pas de cliffhanger.",
  Dimanche: "Dimanche : conclure la semaine. Récapituler ce que les personnages ont appris, avec une fin apaisée. Pas de cliffhanger."
};

/** Number of characters kept from a raw previous chapter (text fallback when no summary exists). */
const PREVIOUS_CHAPTER_TAIL = 1500;
/** Number of characters kept from the last scene of the previous day. */
const PREVIOUS_ENDING_MAX = 800;
/** Number of characters kept from the opening sentence of each previous day. */
const OPENING_MAX = 200;
/** Index of Friday: the days before end on suspense, Friday solves the plot. */
const SUSPENSE_LAST_DAY = 4;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
/** Feasts on a fixed date: [month, day, name]. */
const FIXED_FEASTS = [
  [1, 1, "le Nouvel An"], [1, 6, "l'Épiphanie (galette des rois)"], [2, 2, "la Chandeleur"], [5, 1, "la fête du Travail"],
  [6, 21, "la fête de la musique"], [7, 14, "la fête nationale"], [10, 31, "Halloween"], [11, 1, "la Toussaint"],
  [11, 11, "l'Armistice"], [12, 6, "la Saint-Nicolas"], [12, 24, "le réveillon de Noël"], [12, 25, "Noël"], [12, 31, "la Saint-Sylvestre"]
];
/** A week more than this far behind the current one belongs to next year (see yearOfWeek). */
const BEHIND_WEEKS = 8;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + days);
  return next;
};
const sameDay = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
/** "samedi 31 octobre", "dimanche 1er novembre". */
const frenchDate = (date) => `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate() === 1 ? "1er" : date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
/** ISO week number of a date. */
const isoWeekOf = (date) => {
  // The ISO week of a date is the week of its Thursday; week 1 holds January 4th
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week1Monday = addDays(jan4, -((jan4.getUTCDay() + 6) % 7));
  return 1 + Math.floor((thursday - week1Monday) / (7 * 86400000));
};
/** Easter Sunday (anonymous Gregorian algorithm). */
const easterSunday = (year) => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};
/**
 * School holidays common to every zone, as the national calendar sets them: autumn holidays from the third
 * Saturday of October, Christmas holidays from the Saturday on or before December 21, two weeks each
 * (school starts again on the Monday 16 days later); summer from the first Saturday of July to September 1st.
 * Winter and spring holidays depend on the zone: not listed.
 * @returns {{name: string, start: Date, end: Date}[]} end: the day school starts again.
 */
const schoolHolidays = (year) => {
  const october1 = new Date(Date.UTC(year, 9, 1));
  const autumn = addDays(october1, ((6 - october1.getUTCDay() + 7) % 7) + 14);
  const december21 = new Date(Date.UTC(year, 11, 21));
  const christmas = addDays(december21, -((december21.getUTCDay() + 1) % 7));
  const july1 = new Date(Date.UTC(year, 6, 1));
  const summer = addDays(july1, (6 - july1.getUTCDay() + 7) % 7);
  return [
    { name: "de la Toussaint", start: autumn, end: addDays(autumn, 16) },
    { name: "de Noël", start: christmas, end: addDays(christmas, 16) },
    { name: "d'été", start: summer, end: new Date(Date.UTC(year, 8, 1)) }
  ];
};

/** Existing themes listed in the prompt (most used first): enough to reuse, short enough for small models. */
export const MAX_EXISTING_THEMES = 80;
/** Titles of the series listed in the prompt (most recent first). */
export const MAX_AVOID_TITLES = 60;
/**
 * Tags that would fit every story: the library ended up with only "Nature", "Curiosité" and "Amitié"
 * (the examples of the former prompt). They are neither asked for nor offered for reuse.
 */
export const VAGUE_TAGS = ["Nature", "Science", "Curiosité", "Aventure", "Découverte"];
const VAGUE_TAG_KEYS = new Set(VAGUE_TAGS.map(normalizeThemeName));
/** Openings models use for the reminder of the previous day: the first sentence must be an action of the day. */
export const FORBIDDEN_OPENINGS = ["Hier", "La veille", "Après avoir", "Alors que"];
const OPENING_RULE = `- La première phrase est une action ou un dialogue du jour. Ne commencez jamais par ${FORBIDDEN_OPENINGS.map(o => `« ${o} »`).join(", ")} : le rappel de la veille vient en deuxième ou troisième phrase.`;

/**
 * Builds the prompts for story generation (Gemini, Gemma and Ollama).
 * The model must answer with JSON matching story_schema.js.
 */
export class PromptHelper {

  /**
   * Stable system instruction: role, child-safety and writing rules, output contract.
   * @returns {string}
   */
  static buildSystemInstruction() {
    return [
      "Tu es un auteur jeunesse francophone, spécialiste de la vulgarisation scientifique et de la nature.",
      "Tu écris des histoires éducatives pour une plateforme qui publie une histoire par jour, autour d'un thème par semaine.",
      "",
      "Règles de contenu :",
      "- Contenu adapté aux enfants : pas de violence, pas de peur excessive, pas de marques ni de personnes réelles.",
      "- Personnages bienveillants ; les conflits se résolvent par la curiosité, l'entraide et la réflexion.",
      "- Faits scientifiques exacts. En cas de doute, reste simple plutôt que faux.",
      "",
      "Règles d'écriture :",
      "- Montre plutôt qu'expliquer : la notion scientifique se découvre à travers l'action et les dialogues.",
      "- Une notion scientifique principale par histoire.",
      "- Pas de morale lourde ni de leçon finale récitée.",
      "- Écris en français, avec une orthographe et une typographie soignées (guillemets « », espaces avant ; : ! ?).",
      "- Uniquement des mots français : aucun anglicisme (pas de « puddle », « splash », « cool »…), aucun mot d'une autre langue, aucun caractère d'un autre alphabet.",
      "- Prénoms : français et variés, choisis pour cette histoire (ne reprenez pas d'office les prénoms des exemples).",
      "- Les dialogues sont toujours entre guillemets français, ouverts et fermés : « Regarde ! » s'écrie la fillette. Une réplique par paragraphe, avec un tiret à chaque changement d'interlocuteur.",
      "- Un seul temps de récit pour toute l'histoire, et pour toute la semaine quand il y en a plusieurs.",
      "- Le texte est le récit lui-même : il ne parle jamais de la consigne (numéro de semaine, suspense, cliffhanger, lecteurs, série d'histoires) et ne se corrige pas en cours de route (« non… », « ou plutôt… »).",
      "",
      "Format : réponds UNIQUEMENT avec un objet JSON valide qui respecte le format demandé. Aucun texte avant ni après, pas de bloc de code markdown, pas de markdown dans les valeurs."
    ].join("\n");
  }

  /**
   * Builds the user prompt.
   * @param {Object} params - Generation parameters
   * @param {string} params.theme - Weekly theme
   * @param {string} params.age - Age group ("4-6" or "4-6 ans")
   * @param {string} [params.day] - Day of week (French) or "Toute la semaine"
   * @param {number} [params.numCharacters] - Number of main characters
   * @param {string} [params.charNames] - Names of characters
   * @param {string} [params.seriesName] - Series name
   * @param {string} [params.previousSummary] - Summary of the previous story (preferred)
   * @param {string} [params.previousChapter] - Previous story content (fallback when no summary)
   * @param {string[]} [params.existingThemes] - Names of the themes already in the library (most used first)
   * @param {string} [params.themeDescription] - Details on the topic of the week
   * @param {boolean} [params.weekSeries] - One day of a 7-day series generated day by day
   * @param {string[]} [params.weekPlan] - Plan of the week (one line per day), written by the first day
   * @param {{day: string, title: string, summary: string, opening?: string}[]} [params.previousDays] - Days already
   *   written this week (opening: first sentence, so the next days open differently)
   * @param {string} [params.previousEnding] - Last paragraph of the previous day (the scene to pick up)
   * @param {{name: string, description: string}[]} [params.characters] - Character sheets, written by the first day
   * @param {number} [params.weekNumber] - ISO week of the story: gives the month and the season
   * @param {string} [params.lengthHint] - Extra length instruction (second try of a story that was too short)
   * @param {string[]} [params.avoidTitles] - Titles already used in the series (other weeks), not to be repeated
   * @returns {string} The constructed prompt
   */
  static buildStoryPrompt(params) {
    const { theme, age, day, numCharacters, charNames, seriesName, previousSummary, previousChapter, existingThemes, themeDescription,
      weekSeries, weekPlan, previousDays, previousEnding, characters, weekNumber, lengthHint, avoidTitles, reservedNames, seriesSheet } = params;
    const isWeek = day === ALL_WEEK;
    const ageKey = this.normalizeAge(age);
    const profile = this.getAgeProfile(ageKey);
    const targetDay = isWeek ? null : this.normalizeDay(day);
    const withWeekPlan = this.wantsWeekPlan(params);
    const withCharacters = this.wantsCharacters(params);

    const mission = isWeek
      ? `Générez une SÉRIE COMPLÈTE de 7 histoires, une par jour, du Lundi à Dimanche, qui forment une seule aventure suivie. Le tableau "stories" contient exactement 7 éléments, dans l'ordre des jours.`
      : `Générez UNE SEULE histoire, pour le ${targetDay || "jour demandé"}. Le tableau "stories" contient exactement 1 élément.`;

    const year = this.yearOfWeek(weekNumber);
    const period = this.getWeekPeriod(weekNumber, year);
    const parameters = [
      `- Sujet de la semaine : « ${theme} ». Reliez-le à la saison ou à un événement du calendrier si c'est pertinent.`,
      period ? `- Période : ${period}. L'histoire se déroule à cette saison (météo, nature).` : "",
      this.getCalendarRule(weekNumber, year),
      themeDescription && String(themeDescription).trim() ? `- Précisions sur le sujet : ${String(themeDescription).trim()}` : "",
      `- Tranche d'âge : ${ageKey} ans.`,
      this.getCharacterPrompt(numCharacters, charNames),
      this.getSeriesContext(seriesName, seriesSheet),
      this.getReservedNamesRule(reservedNames, [seriesName, charNames])
    ].filter(Boolean).join("\n");

    const audience = [
      isWeek
        ? `- Longueur : ${this.getLengthRule(ageKey)} pour chacune des 7 histoires. Ne raccourcissez pas les derniers jours.`
        : `- Longueur : ${this.getLengthRule(ageKey)}.`,
      "- Pour atteindre cette longueur, développez les scènes (actions, dialogues, sensations, émotions), jamais en ajoutant des paragraphes de remplissage ou des commentaires sur le texte. Une histoire plus courte est incomplète.",
      `- Style : ${profile.storyStyle}`,
      `- Titre : court, captivant et unique${isWeek ? " (7 titres différents)" : ""}.`,
      this.getAvoidTitlesRule(avoidTitles),
      lengthHint && String(lengthHint).trim() ? `- IMPORTANT : ${String(lengthHint).trim()}` : ""
    ].filter(Boolean).join("\n");

    const dayRules = isWeek
      ? STORY_DAYS.map(d => `- ${DAY_RULES[d]}`).join("\n")
      : `- ${DAY_RULES[targetDay] || "Histoire complète avec un début, un milieu et une fin."}`;

    const illustration = [
      `- Pour chaque histoire, une seule description d'illustration (champ "illustration_prompt"), très détaillée : scène, personnages (apparence, vêtements, expressions), action, décor, lumière, couleurs, cadrage.`,
      `- ${profile.illustrationStyle}`,
      this.cleanCharacters(characters).length > 0
        ? `- Décrivez les personnages exactement comme dans la fiche PERSONNAGES (même âge, mêmes cheveux, mêmes vêtements).`
        : `- Continuité visuelle : les personnages récurrents sont décrits avec les mêmes traits d'un jour à l'autre.`,
      `- Aucun texte écrit dans l'image.`
    ].join("\n");

    return [
      "## MISSION",
      mission,
      "",
      "## PARAMÈTRES",
      parameters,
      "",
      "## PUBLIC",
      audience,
      "",
      "## CONTINUITÉ",
      this.getContinuityPrompt({ isWeek, previousSummary, previousChapter, weekSeries, targetDay, weekPlan, previousDays, previousEnding, characters }),
      "",
      "## SPÉCIFICITÉS DU JOUR",
      dayRules,
      "",
      "## ILLUSTRATION",
      illustration,
      "",
      "## ÉTIQUETTES",
      this.getThemesPrompt(existingThemes, { isWeek }),
      "",
      "## FORMAT DE SORTIE",
      this.getOutputFormat(isWeek ? "Lundi" : (targetDay || "Lundi"), { withWeekPlan, withCharacters })
    ].join("\n");
  }

  /**
   * Titles already used by other weeks of the series: a new story must not take one again
   * (a mass generation repeated "Le festin des oiseaux" three times).
   * @param {string[]} [titles]
   * @returns {string} The rule, or "" when there is none.
   */
  static getAvoidTitlesRule(titles) {
    const list = [...new Set((Array.isArray(titles) ? titles : []).map(title => String(title || "").trim()).filter(Boolean))].slice(0, MAX_AVOID_TITLES);
    return list.length > 0
      ? `- Titres déjà utilisés dans cette série, à ne pas reprendre ni imiter de près : ${list.map(title => `« ${title} »`).join(", ")}.`
      : "";
  }

  /** "4-6 ans" / "4-6" / unknown -> "4-6". */
  static normalizeAge(age) {
    const normalized = String(age || "").replace(/\s*ans\s*$/i, "").trim();
    return KNOWN_AGES.includes(normalized) ? normalized : DEFAULT_AGE;
  }

  /** "lundi", "Lundi.", "**Mercredi**" -> "Lundi" / "Mercredi"; unknown -> null. */
  static normalizeDay(day) {
    const cleaned = String(day || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z]/g, "").toLowerCase();
    return STORY_DAYS.find(d => d.toLowerCase() === cleaned) || null;
  }

  /**
   * Writing profile of an age group.
   * @param {string} age - "4-6" or "4-6 ans" (unknown values fall back to 4-6).
   * @returns {{wordCount: string, paragraphs: string, minParagraphs: number, maxParagraphWords: number, storyStyle: string, illustrationStyle: string}}
   */
  static getAgeProfile(age) {
    return { ...AGE_PROFILES[this.normalizeAge(age)] };
  }

  /**
   * Length instruction of an age group: minimum number of paragraphs, their size, and the word count it makes.
   * @param {string} age - Age group.
   * @returns {string} e.g. "au moins 7 paragraphes (7 à 9 paragraphes de 3 à 4 phrases), soit au moins 300 mots (environ 300-450 mots)"
   */
  static getLengthRule(age) {
    const profile = this.getAgeProfile(age);
    const { min, max } = this.getTargetWords(age);
    return `au moins ${profile.minParagraphs} paragraphes (${profile.paragraphs}), soit au moins ${min} mots (${profile.wordCount}), et jamais plus de ${max} mots`;
  }

  /**
   * Target length of a story, as numbers ("environ 900-1100 mots" -> { min: 900, max: 1100 }).
   * @param {string} age - Age group.
   * @returns {{min: number, max: number}}
   */
  static getTargetWords(age) {
    const [min, max] = (this.getAgeProfile(age).wordCount.match(/\d+/g) || []).map(Number);
    return { min: min || 0, max: max || min || 0 };
  }

  static getCharacterPrompt(numCharacters, charNames) {
    const lines = [];
    if (numCharacters && numCharacters > 0) {
      lines.push(`- Nombre de personnages principaux : ${numCharacters}.`);
    }
    if (charNames && String(charNames).trim()) {
      lines.push(`- Noms des personnages principaux : ${String(charNames).trim()}.`);
    }
    return lines.join("\n");
  }

  /**
   * Series of the story, with its fixed character sheet (written by its first generated week, or by the user),
   * so the hero keeps the same age, look and family from one week to the next.
   * @param {string} [seriesName]
   * @param {string} [seriesSheet] - Character sheet of the series.
   */
  static getSeriesContext(seriesName, seriesSheet) {
    if (!seriesName || !String(seriesName).trim()) return "";
    const lines = [`- Série : « ${String(seriesName).trim()} ». Restez fidèle à l'univers et aux personnages de cette série.`];
    const sheet = String(seriesSheet || "").trim();
    if (sheet) {
      lines.push(`- Fiche de la série, à respecter à l'identique (prénoms, âge, apparence, famille, liens entre personnages) : ${sheet}`);
    }
    return lines.join("\n");
  }

  /**
   * Names of the heroes of the other series: a story outside a series must not borrow them
   * (the library had a bat called Léonie and a toad called Antonin next to the series of the same names).
   * @param {string[]} [reservedNames] - Names of the series heroes.
   * @param {string[]} [allowed] - Series name and requested character names of this story.
   */
  static getReservedNamesRule(reservedNames, allowed = []) {
    const allowedText = allowed.filter(Boolean).join(" ").toLowerCase();
    const names = [...new Set((Array.isArray(reservedNames) ? reservedNames : []).map(name => String(name || "").trim()).filter(Boolean))]
      .filter(name => !allowedText.includes(name.toLowerCase()));
    return names.length > 0
      ? `- Prénoms réservés aux héros d'autres séries, à ne pas utiliser : ${names.map(name => `« ${name} »`).join(", ")}.`
      : "";
  }

  /**
   * Tags of the stories (output field "themes"): 2 or 3 per story, the precise subject of this story first,
   * then the values lived in it. Existing tags are reused only when they describe the story exactly,
   * so the library neither fills with near-duplicates nor collapses on a few vague tags.
   * @param {string[]} [existingThemes] - Existing theme names, most used first.
   * @param {{isWeek?: boolean}} [options] - isWeek: 7 stories in the answer.
   */
  static getThemesPrompt(existingThemes = [], { isWeek = false } = {}) {
    const names = [...new Set((existingThemes || []).map(name => String(name).trim()).filter(Boolean))]
      .filter(name => !VAGUE_TAG_KEYS.has(normalizeThemeName(name)))
      .slice(0, MAX_EXISTING_THEMES);
    const lines = [
      "- Le champ \"themes\" contient 2 ou 3 étiquettes qui décrivent CETTE histoire :",
      "  1. d'abord sa notion ou son univers précis (un animal, un phénomène, un lieu, une activité…), en 1 à 4 mots ;",
      "  2. puis 1 ou 2 valeurs ou émotions vécues par les personnages dans cette histoire (par exemple entraide, patience, courage, partage, persévérance, confiance en soi, gentillesse, respect, gestion de la colère, ouverture aux autres, gratitude…).",
      `- Pas d'étiquette vague qui conviendrait à toutes les histoires : ${VAGUE_TAGS.map(tag => `« ${tag} »`).join(", ")}.`,
      isWeek ? "- D'un jour à l'autre, les valeurs changent : les 7 histoires n'ont pas toutes les mêmes étiquettes." : ""
    ];
    if (names.length > 0) {
      lines.push(
        "- ÉTIQUETTES EXISTANTES : si l'une décrit exactement l'histoire, reprenez son nom à l'identique :",
        `  ${names.map(name => `« ${name} »`).join(", ")}.`,
        "- Sinon, créez une étiquette nouvelle : mieux vaut une étiquette précise et nouvelle qu'une étiquette existante approximative."
      );
    }
    return lines.filter(Boolean).join("\n");
  }

  /**
   * The first day of a week generated day by day also writes the plan of the whole week.
   * @param {Object} params - Same parameters as buildStoryPrompt.
   * @returns {boolean}
   */
  static wantsWeekPlan({ day, weekSeries, previousDays, previousEnding, previousSummary, weekPlan } = {}) {
    return Boolean(weekSeries)
      && day !== ALL_WEEK
      && this.normalizeDay(day) === STORY_DAYS[0]
      && !(previousDays && previousDays.length) && !previousEnding && !previousSummary
      && !(weekPlan && weekPlan.length);
  }

  /**
   * The answer carries the character sheets: the first day of a week generated day by day, and a whole week
   * in one answer (its 7 stories then share one cast, with fixed names and family ties).
   * @param {Object} params - Same parameters as buildStoryPrompt.
   * @returns {boolean}
   */
  static wantsCharacters(params = {}) {
    return params.day === ALL_WEEK || this.wantsWeekPlan(params);
  }

  /**
   * What the end of the day may (not) open, so the week tells one story that closes:
   * Monday to Thursday, the suspense prepares tomorrow's step; Friday closes every open question;
   * the weekend opens nothing.
   * @param {number} dayIndex - 0 (Monday) to 6 (Sunday).
   * @param {boolean} hasPlan - A plan of the week is known.
   */
  static getMysteryRule(dayIndex, hasPlan) {
    if (dayIndex >= 0 && dayIndex < SUSPENSE_LAST_DAY) {
      return hasPlan
        ? "- Le suspense de fin prépare l'étape de demain du plan. N'introduisez pas de nouveau mystère, objet ou personnage hors du plan."
        : "- Le suspense de fin découle de l'intrigue en cours. N'introduisez pas de nouveau mystère sans lien avec elle.";
    }
    if (dayIndex === SUSPENSE_LAST_DAY) {
      return "- Résolvez tous les mystères et questions ouverts depuis lundi (voir DÉJÀ RACONTÉ) : ne laissez aucun fil en suspens.";
    }
    return "- L'intrigue est résolue : ne rouvrez aucun mystère et n'en introduisez pas de nouveau.";
  }

  /**
   * Period of an ISO week of the current year, by its Thursday (ISO rule).
   * @param {number} weekNumber - 1 to 53.
   * @param {number} [year] - Defaults to the current year.
   * @returns {string|null} "fin juillet, en été", or null for an invalid week.
   */
  static getWeekPeriod(weekNumber, year = new Date().getFullYear()) {
    const week = Number(weekNumber);
    if (!Number.isInteger(week) || week < 1 || week > 53) return null;
    // Week 1 contains January 4th; its Thursday is 3 days after its Monday
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const thursday = new Date(jan4);
    thursday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7 + 3);

    const month = thursday.getUTCMonth();
    const day = thursday.getUTCDate();
    const part = day <= 10 ? "début" : day <= 20 ? "mi-" : "fin";
    const season = [11, 0, 1].includes(month) ? "hiver" : month <= 4 ? "printemps" : month <= 7 ? "été" : "automne";
    const label = part === "mi-" ? `mi-${MONTHS[month]}` : `${part} ${MONTHS[month]}`;
    return `${label}, ${season === "été" || season === "hiver" || season === "automne" ? "en" : "au"} ${season}`;
  }

  /**
   * Year a week of the program belongs to: the program looks ahead, so a week far behind the current one
   * is next year's (week 1 generated in October is next January).
   * @param {number} weekNumber
   * @param {Date} [now]
   * @returns {number}
   */
  static yearOfWeek(weekNumber, now = new Date()) {
    const year = now.getUTCFullYear();
    const week = Number(weekNumber);
    if (!Number.isInteger(week)) return year;
    return week < isoWeekOf(now) - BEHIND_WEEKS ? year + 1 : year;
  }

  /**
   * Monday to Sunday of an ISO week.
   * @returns {Date[]} 7 UTC dates.
   */
  static getWeekDates(weekNumber, year) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(weekNumber) - 1) * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() + index);
      return date;
    });
  }

  /**
   * Feasts and school holidays of a week (metropolitan France, holidays common to every zone).
   * @returns {{dates: Date[], feasts: {date: Date, name: string}[], holidays: {name: string, start: Date, end: Date}[]}}
   *   holidays: end is the day school starts again.
   */
  static getCalendarEvents(weekNumber, year) {
    const dates = this.getWeekDates(weekNumber, year);
    const inWeek = (date) => dates.some(day => sameDay(day, date));
    const feasts = [];
    for (const y of new Set(dates.map(date => date.getUTCFullYear()))) {
      const easter = easterSunday(y);
      const candidates = [
        ...FIXED_FEASTS.map(([month, day, name]) => ({ date: new Date(Date.UTC(y, month - 1, day)), name })),
        { date: addDays(easter, -47), name: "Mardi gras" },
        { date: easter, name: "Pâques" },
        { date: addDays(easter, 1), name: "le lundi de Pâques" }
      ];
      feasts.push(...candidates.filter(feast => inWeek(feast.date)));
    }
    feasts.sort((a, b) => a.date - b.date);

    const holidays = [];
    for (const y of new Set(dates.map(date => date.getUTCFullYear()))) {
      for (const holiday of schoolHolidays(y)) {
        // Overlaps the week: from its first day (Saturday) to the eve of the return to school
        if (holiday.start <= dates[6] && addDays(holiday.end, -1) >= dates[0]) holidays.push(holiday);
      }
    }
    return { dates, feasts, holidays };
  }

  /**
   * Calendar line of the prompt: the exact days of the week, its feasts and school holidays.
   * Models placed Christmas a week early, Christmas Eve in the first days of January
   * and the return to school in the middle of the autumn holidays.
   * @returns {string} "" for an invalid week.
   */
  static getCalendarRule(weekNumber, year = this.yearOfWeek(weekNumber)) {
    const week = Number(weekNumber);
    if (!Number.isInteger(week) || week < 1 || week > 53) return "";
    const { dates, feasts, holidays } = this.getCalendarEvents(week, year);
    const facts = [
      ...feasts.map(feast => `${feast.name} le ${frenchDate(feast.date)}`),
      ...holidays.map(holiday => {
        const during = holiday.start <= dates[0] && holiday.end > dates[6] ? "toute la semaine" : `du ${frenchDate(holiday.start)} au ${frenchDate(addDays(holiday.end, -1))}`;
        return `vacances scolaires ${holiday.name} ${during} (l'école reprend le ${frenchDate(holiday.end)})`;
      })
    ];
    const lines = [`- Calendrier : la semaine va du ${frenchDate(dates[0])} au ${frenchDate(dates[6])} ${dates[6].getUTCFullYear()}.`];
    if (facts.length > 0) {
      lines.push(`  Cette semaine : ${facts.join(" ; ")}.`);
      lines.push("  Une fête ne se célèbre que le jour où elle tombe : avant, on la prépare ou on l'attend ; après, on s'en souvient. Pendant les vacances, il n'y a pas d'école.");
    }
    return lines.join("\n");
  }

  /** Character sheets kept from the first day: [{ name, description }] with a name. */
  static cleanCharacters(characters) {
    return (Array.isArray(characters) ? characters : [])
      .map(character => ({ name: String(character?.name || '').trim(), description: String(character?.description || '').trim() }))
      .filter(character => character.name);
  }

  /**
   * Continuity of a week generated day by day: the plan of the week, the characters, what was already told,
   * and how the previous day ended. Each story happens on a new day and must make sense on its own.
   * @returns {string|null} The section, or null when there is no context yet.
   */
  static getWeekSeriesContinuity({ targetDay, weekPlan, previousDays, previousEnding, characters }) {
    const plan = (Array.isArray(weekPlan) ? weekPlan : []).map(line => String(line || '').trim()).filter(Boolean);
    const days = (Array.isArray(previousDays) ? previousDays : []).filter(entry => entry && (entry.title || entry.summary));
    const ending = String(previousEnding || '').trim().slice(-PREVIOUS_ENDING_MAX);
    const cast = this.cleanCharacters(characters);
    if (plan.length === 0 && days.length === 0 && !ending) return null;

    const dayIndex = STORY_DAYS.indexOf(targetDay);
    const lines = [`Cette histoire est le ${targetDay || "jour suivant"} d'une aventure suivie sur 7 jours, avec les mêmes personnages.`];

    if (cast.length > 0) {
      lines.push("", "PERSONNAGES (mêmes noms, même apparence, même caractère) :");
      cast.forEach(character => lines.push(`- ${character.name}${character.description ? ` : ${character.description}` : ""}`));
    }
    if (plan.length > 0) {
      lines.push("", "PLAN DE LA SEMAINE (le fil rouge à suivre) :");
      plan.forEach((step, index) => lines.push(`- ${STORY_DAYS[index] || `Jour ${index + 1}`} : ${step}`));
      if (dayIndex >= 0 && plan[dayIndex]) lines.push(`Aujourd'hui (${targetDay}) : ${plan[dayIndex]}`);
      if (dayIndex >= 0 && dayIndex < SUSPENSE_LAST_DAY && plan[dayIndex + 1]) {
        lines.push(`Demain (${STORY_DAYS[dayIndex + 1]}) : ${plan[dayIndex + 1]}`);
      }
    }
    if (days.length > 0) {
      lines.push("", "DÉJÀ RACONTÉ :");
      days.forEach(entry => lines.push(`- ${entry.day || "Jour précédent"}${entry.title ? ` « ${String(entry.title).trim()} »` : ""} : ${String(entry.summary || "").trim()}`));
    }
    if (ending) {
      lines.push("", "FIN DE L'HISTOIRE D'HIER (pour mémoire, à ne pas recopier) :", `"""${ending}"""`);
    }
    const openings = days
      .map(entry => String(entry.opening || "").trim().slice(0, OPENING_MAX))
      .filter(Boolean);
    if (openings.length > 0) {
      lines.push("", "DÉBUTS DÉJÀ UTILISÉS (ne pas imiter) :");
      openings.forEach(opening => lines.push(`- « ${opening} »`));
    }

    lines.push(
      "",
      "Consignes de continuité :",
      "- Cette histoire se passe un nouveau jour, le lendemain de la précédente.",
      "- Ouvrez sur une scène nouvelle, différente des débuts déjà utilisés (pas la même tournure, pas la même météo, pas le même geste), puis glissez en une phrase le rappel de la veille en nommant le personnage principal : l'enfant n'a peut-être pas lu l'histoire d'hier.",
      OPENING_RULE,
      "- Ne répétez pas les mêmes gestes ou tics descriptifs d'un jour à l'autre (ex. ajuster ses lunettes) : la fiche des personnages sert à la cohérence, pas à être récitée.",
      ending
        ? "- Puis répondez au suspense laissé hier et racontez l'étape du jour."
        : "- Puis racontez l'étape du jour.",
      "- Ne recopiez aucune phrase des histoires précédentes.",
      "- Faites avancer l'intrigue. Ne recommencez pas une recherche, une découverte ou une rencontre déjà racontée.",
      "- Ne décrivez pas de nouveau les personnages en détail comme au premier jour : gardez leurs noms, leurs traits et leur caractère."
    );
    lines.push(this.getMysteryRule(dayIndex, plan.length > 0));
    const titles = days.map(entry => String(entry.title || "").trim()).filter(Boolean);
    if (titles.length > 0) {
      lines.push(`- Le titre doit être différent de : ${titles.map(title => `« ${title} »`).join(", ")}.`);
    }
    return lines.join("\n");
  }

  static getContinuityPrompt({ isWeek, previousSummary, previousChapter, weekSeries = false, targetDay = null, weekPlan, previousDays, previousEnding, characters }) {
    if (weekSeries && !isWeek) {
      const series = this.getWeekSeriesContinuity({ targetDay, weekPlan, previousDays, previousEnding, characters });
      if (series) return series;
    }

    const summary = previousSummary && String(previousSummary).trim();
    const chapter = !summary && previousChapter && String(previousChapter).trim();

    if (summary || chapter) {
      const context = summary
        ? summary
        : `… ${chapter.slice(-PREVIOUS_CHAPTER_TAIL)}`;
      return [
        "RÉSUMÉ PRÉCÉDENT (histoire de la veille) :",
        `"""${context}"""`,
        "CONTINUITÉ : Enchaînez logiquement sur ce résumé, avec les mêmes personnages, et faites avancer l'intrigue. Ne racontez pas à nouveau l'histoire de la veille ; le titre doit être différent."
      ].join("\n");
    }

    if (isWeek) {
      // Same rules as a week generated day by day, written in one answer
      return [
        "Les 7 histoires forment une seule aventure suivie, du lundi au dimanche, avec les mêmes personnages : mêmes noms, même apparence (âge, cheveux, vêtements), même caractère et mêmes liens entre eux (frère, cousine, ami…), dans le texte comme dans les illustrations.",
        "- Établissez d'abord la fiche des personnages (champ \"characters\") et suivez-la à l'identique pendant les 7 jours.",
        "- Les 7 histoires sont toutes différentes : n'en recopiez aucune, et chaque histoire parle de son propre jour.",
        "- Chaque histoire se passe un nouveau jour et doit se comprendre seule : elle s'ouvre sur une scène nouvelle, puis rappelle en une phrase où en était l'aventure la veille, en nommant le personnage principal.",
        OPENING_RULE,
        "- Les 7 débuts sont tous différents (pas la même tournure, ni la même météo, ni le même geste). Ne recopiez aucune phrase d'une histoire à l'autre, et ne répétez pas les mêmes tics descriptifs.",
        "- Chaque jour apporte une découverte nouvelle : ne recommencez pas une recherche ou une découverte déjà racontée.",
        "- Du lundi au jeudi, le suspense de fin mène directement à l'histoire du lendemain ; n'ouvrez aucun mystère qui ne sera pas résolu. Le vendredi résout tous les mystères de la semaine. Le samedi et le dimanche n'en rouvrent aucun."
      ].join("\n");
    }
    // First day of a week generated day by day: it also plans the week, the following days continue it
    return weekSeries
      ? [
        "Cette histoire ouvre une aventure suivie sur 7 jours, du lundi au dimanche, avec les mêmes personnages : posez les personnages et l'enjeu de la semaine.",
        "Avant d'écrire, établissez le plan de la semaine (champ \"week_plan\") : 7 phrases, une par jour de Lundi à Dimanche, qui décrivent l'étape de l'aventure ce jour-là. Une seule intrigue qui progresse : suspense du lundi au jeudi, résolution le vendredi, activité en famille le samedi, conclusion le dimanche. Chaque jour apporte une découverte nouvelle, sans répéter les précédentes.",
        "Établissez aussi la fiche des personnages (champ \"characters\") : 1 à 4 personnages, chacun avec \"name\" et \"description\" (âge, apparence précise : cheveux, vêtements, signe distinctif, caractère, et lien avec les autres personnages). Reprenez les noms demandés. Cette fiche sera suivie à l'identique tous les jours, dans le texte et les illustrations.",
        "L'histoire de ce lundi raconte seulement la première étape du plan : ne dévoilez pas les découvertes des jours suivants.",
        "Le suspense de fin annonce la deuxième étape de votre plan. N'introduisez pas de mystère qui n'est pas dans le plan : chaque question ouverte cette semaine sera résolue vendredi."
      ].join("\n")
      : "Cette histoire est une aventure autonome : elle doit se comprendre sans avoir lu les autres jours.";
  }

  static getOutputFormat(exampleDay, { withWeekPlan = false, withCharacters = withWeekPlan } = {}) {
    const characterField = "\"characters\" (tableau de personnages { \"name\", \"description\" } : âge, apparence, caractère et lien avec les autres personnages, par exemple frère, cousine ou ami)";
    const opening = withWeekPlan
      ? `Un objet JSON avec trois clés : "week_plan" (tableau de 7 phrases, une par jour, de Lundi à Dimanche), ${characterField}, puis "stories" : un tableau d'histoires. Chaque histoire a exactement ces champs :`
      : withCharacters
        ? `Un objet JSON avec deux clés : ${characterField}, puis "stories" : un tableau d'histoires. Chaque histoire a exactement ces champs :`
        : "Un objet JSON avec une seule clé \"stories\" : un tableau d'histoires. Chaque histoire a exactement ces champs :";
    return [
      opening,
      `- "day" : jour de la semaine, parmi ${STORY_DAYS.map(d => `"${d}"`).join(", ")}.`,
      "- \"title\" : le titre, sans guillemets ni markdown.",
      "- \"summary\" : 2 ou 3 phrases qui serviront de contexte au jour suivant : ce qui s'est passé, ce que les personnages ont découvert, et la situation exacte à la fin (le suspense laissé pour demain).",
      "- \"themes\" : 2 ou 3 étiquettes (voir ÉTIQUETTES), la notion précise en premier, chacune avec \"name\", \"description\" (une phrase), \"icon\" (un emoji) et \"color\" (code hexadécimal, ex. \"#4CAF50\").",
      "- \"paragraphs\" : uniquement le texte de l'histoire, un paragraphe par élément : jamais le titre, la description d'illustration, ni un commentaire sur le texte ou sa longueur.",
      "- \"illustration_prompt\" : la description détaillée de l'illustration.",
      "",
      "Exemple de structure (contenu à remplacer) :",
      // Placeholder names only: models reuse the names of the examples
      JSON.stringify({
        ...(withWeekPlan ? { week_plan: STORY_DAYS.map(d => `Étape du ${d.toLowerCase()}…`) } : {}),
        ...(withCharacters ? {
          characters: [{ name: "(prénom choisi)", description: "Fillette de 6 ans, tresses rousses, ciré jaune, curieuse et rieuse ; grande sœur de… " }]
        } : {}),
        stories: [{
          day: exampleDay,
          title: "Le secret de la goutte d'eau",
          summary: "L'héroïne découvre d'où vient la pluie…",
          themes: [
            { name: "Cycle de l'eau", description: "Comment la pluie se forme", icon: "💧", color: "#2196F3" },
            { name: "Patience", description: "Attendre et observer avant de comprendre", icon: "⏳", color: "#9C27B0" }
          ],
          paragraphs: ["Premier paragraphe…", "Deuxième paragraphe…"],
          illustration_prompt: "Une petite fille aux tresses rousses, en ciré jaune…"
        }]
      })
    ].join("\n");
  }
}
