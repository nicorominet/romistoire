/**
 * AI audit of a week written with a series bible: one request reads the 7 stories against the bible and answers
 * with the drifts found, a recap of the week (memory of the next weeks) and the new facts it established.
 * The audit always compares to the bible, never to the previous week, so drifts do not add up.
 * Pure functions: no I/O.
 */

export const AUDIT_SYSTEM = [
  "Vous êtes le directeur de la continuité d'une série d'histoires pour enfants.",
  "Vous comparez des histoires à la BIBLE de la série, qui fait foi, et vous signalez chaque écart précis, sans rien inventer.",
  "Vous répondez uniquement par un objet JSON valide, sans markdown ni commentaire."
].join(" ");

export const AUDIT_ISSUE_TYPES = ['name', 'age', 'appearance', 'personality', 'relation', 'rule', 'fact', 'new-character', 'theme', 'other'];
export const AUDIT_SEVERITIES = ['low', 'medium', 'high'];
/** Characters of each story given to the audit: enough to read a week of the oldest ages. */
const STORY_TEXT_MAX = 9000;
const RECAP_MAX = 600;
const MAX_ISSUES = 30;
const MAX_FACTS = 5;

/**
 * The cast as one block of text (same reading as the generation prompt).
 * @param {{characters: Object[], universe?: string, rules?: string[]}} cast - Cast as told this week.
 */
const castText = (cast) => {
  const names = new Map((cast.characters || []).map(character => [character.key, character.name]));
  const lines = (cast.characters || []).map(character => {
    const physical = Object.values(character.physical || {}).filter(Boolean).join(', ');
    const ties = (character.relations || []).filter(relation => names.has(relation.to))
      .map(relation => `${relation.type} de ${names.get(relation.to)}`).join(', ');
    return `- ${character.name} (${[character.role === 'main' ? 'principal' : 'récurrent', character.species, character.gender,
      character.currentAge != null ? `${character.currentAge} ans` : ''].filter(Boolean).join(', ')})`
      + `${physical ? ` ; apparence : ${physical}` : ''}${character.visual ? ` ; illustration : ${character.visual}` : ''}`
      + `${character.personality ? ` ; caractère : ${character.personality}` : ''}${ties ? ` ; liens : ${ties}` : ''}`;
  });
  return [
    cast.universe ? `Univers : ${cast.universe}` : '',
    'Personnages :', ...lines,
    ...(cast.rules?.length ? ['Règles :', ...cast.rules.map(rule => `- ${rule}`)] : [])
  ].filter(Boolean).join('\n');
};

/**
 * @param {{cast: Object, facts?: {text: string}[], stories: {day: string, title: string, text: string, illustrationPrompt?: string}[],
 *   theme?: string, weekNumber?: number, ageGroup?: string}} input
 * @returns {string}
 */
export const buildWeekAuditPrompt = ({ cast, facts = [], stories, theme, weekNumber, ageGroup }) => [
  "## BIBLE DE LA SÉRIE (fait foi)",
  castText(cast),
  facts.length ? `\nFaits établis avant cette semaine :\n${facts.map(fact => `- ${fact.text}`).join('\n')}` : '',
  "",
  `## SEMAINE ${weekNumber ?? ''}${theme ? ` : sujet « ${theme} »` : ''}${ageGroup ? ` (${ageGroup} ans)` : ''}`,
  ...stories.map(story => [
    `### ${story.day} : « ${story.title} »`,
    String(story.text || '').slice(0, STORY_TEXT_MAX),
    story.illustrationPrompt ? `(Illustration : ${story.illustrationPrompt})` : ''
  ].filter(Boolean).join('\n')),
  "",
  "## CONSIGNES",
  "Relevez chaque écart entre ces histoires et la BIBLE : prénom changé, âge différent, apparence modifiée (cheveux, vêtements, signe distinctif, dans le texte ou l'illustration), caractère contraire, lien familial ou amical contredit, règle de l'univers enfreinte, fait établi contredit, nouveau personnage qui prend la place d'un personnage principal ou qui rejoint la famille, sujet de la semaine qui change la distribution.",
  "Ne relevez pas les choix d'écriture ni les personnages secondaires ponctuels qui ne contredisent rien.",
  "Gravité : « high » si un enfant qui suit la série verrait une contradiction (prénom, âge, lien, apparence principale) ; « medium » pour un détail visible ; « low » pour une nuance.",
  "",
  "## FORMAT DE SORTIE",
  `Un objet JSON : { "issues": [ { "day": "Lundi", "character": "prénom ou vide", "type": un parmi ${AUDIT_ISSUE_TYPES.map(type => `"${type}"`).join(', ')}, "quote": "citation exacte et courte du texte", "explanation": "l'écart, en une phrase", "severity": "low" | "medium" | "high" } ],`,
  `  "recap": "résumé de la semaine en 2 ou 3 phrases, pour mémoire des semaines suivantes",`,
  `  "new_facts": [ "fait durable établi cette semaine et qui comptera ensuite (ex. : ils ont adopté un chat nommé Pompon)", … au plus ${MAX_FACTS}, souvent aucun ] }`,
  "Si tout est conforme, \"issues\" est un tableau vide.",
  // Week 43, Oct. 2026: "Antonin a un costume d'ailes de chauve-souris" was proposed as a fact
  "\"new_facts\" ne contient qu'un changement durable de la vie des personnages, encore vrai dans plusieurs mois (un animal adopté, un déménagement, une nouvelle école, un objet qu'ils gardent) ; jamais une activité, un déguisement, un repas ou une sortie de la semaine. Le plus souvent, il est vide."
].filter(line => line !== '').join('\n');

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Reads the answer of the audit (JSON, possibly wrapped in markdown or text).
 * @param {string} text
 * @param {string[]} [days] - Days of the week audited (an issue on another day is dropped).
 * @returns {{issues: Object[], recap: string, newFacts: string[]}|null} null when unreadable.
 */
export const parseWeekAudit = (text, days = []) => {
  const raw = String(text || '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data;
  try { data = JSON.parse(raw.slice(start, end + 1)); } catch (error) { return null; }
  if (!data || typeof data !== 'object') return null;

  const issues = (Array.isArray(data.issues) ? data.issues : [])
    .filter(issue => issue && (issue.explanation || issue.quote))
    .map(issue => ({
      day: clip(issue.day, 20),
      character: clip(issue.character, 60),
      type: AUDIT_ISSUE_TYPES.includes(issue.type) ? issue.type : 'other',
      quote: clip(issue.quote, 300),
      explanation: clip(issue.explanation, 400),
      severity: AUDIT_SEVERITIES.includes(issue.severity) ? issue.severity : 'medium',
      source: 'ai'
    }))
    .filter(issue => days.length === 0 || !issue.day || days.includes(issue.day))
    .slice(0, MAX_ISSUES);
  const facts = Array.isArray(data.new_facts) ? data.new_facts : Array.isArray(data.newFacts) ? data.newFacts : [];
  return {
    issues,
    recap: clip(data.recap, RECAP_MAX),
    newFacts: facts.map(fact => clip(typeof fact === 'string' ? fact : fact?.text, 500)).filter(Boolean).slice(0, MAX_FACTS)
  };
};

/** Recap without AI: the summaries of the days, shortened. */
export const fallbackRecap = (stories) => clip(
  stories.map(story => story.summary || '').filter(Boolean).join(' '), RECAP_MAX
);
