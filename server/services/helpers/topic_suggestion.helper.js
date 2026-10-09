/**
 * AI suggestions of topics for the weeks of the program that have none.
 */

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Month of an ISO week (its Thursday), as a season hint for the prompt. */
export const monthOfWeek = (week, year = new Date().getFullYear()) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  return MONTHS[thursday.getUTCMonth()];
};

export const TOPIC_SUGGESTION_SYSTEM =
  "Tu conçois le programme annuel d'histoires éducatives pour enfants de 2 à 18 ans. " +
  'Chaque semaine a un sujet de découverte (science, nature, culture, vivre ensemble…) qui guidera 7 histoires. ' +
  'Tu réponds uniquement en JSON valide, sans texte autour.';

/**
 * @param {number[]} weeks - Weeks to fill.
 * @param {{week_number: number, theme_name: string}[]} existing - Topics already in the program (to avoid).
 */
export const buildTopicSuggestionPrompt = (weeks, existing) => [
  'Propose un sujet pour chacune de ces semaines (le mois indique la saison) :',
  ...weeks.map(week => `- semaine ${week} (${monthOfWeek(week)})`),
  '',
  existing.length
    ? `Sujets déjà au programme, à ne pas répéter ni paraphraser : ${existing.map(e => e.theme_name).join(' ; ')}.`
    : "Aucun sujet n'est encore au programme.",
  '',
  'Règles : un sujet concret et différent par semaine, adapté à la saison quand c\'est pertinent ; nom court (2 à 6 mots) ; ' +
  'description d\'une ou deux phrases qui précise la notion à faire découvrir.',
  'Format exact : [{"week": 12, "name": "…", "description": "…"}]'
].join('\n');

/**
 * Reads the AI answer: JSON array (possibly inside a code fence or surrounded by text).
 * Keeps only the weeks asked, one suggestion each.
 * @returns {{week: number, name: string, description: string}[]}
 */
export const parseTopicSuggestions = (text, weeks) => {
  const raw = String(text || '');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  let items;
  try {
    items = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    return [];
  }
  const wanted = new Set(weeks);
  const seen = new Set();
  const suggestions = [];
  for (const item of Array.isArray(items) ? items : []) {
    const week = Number(item?.week);
    const name = String(item?.name ?? '').trim().slice(0, 150);
    if (!wanted.has(week) || seen.has(week) || !name) continue;
    seen.add(week);
    suggestions.push({ week, name, description: String(item?.description ?? '').trim().slice(0, 500) });
  }
  return suggestions.sort((a, b) => a.week - b.week);
};
