/**
 * Image prompts ready to paste into an image tool (Gemini app, ChatGPT, the Gemini Canvas tool...).
 * The image models of the Gemini API have no free quota: images are made outside the app,
 * then attached back to their story thanks to the code in the file name.
 */

const CODE_LENGTH = 8;
export const CODE_PATTERN = /IMG-([0-9a-f]{8})/i;

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const YOUNG_STYLE = "Illustration de livre pour enfants, aquarelle douce, couleurs pastel, formes rondes, personnages expressifs et attendrissants.";
const CHILD_STYLE = "Illustration jeunesse colorée et détaillée, style album illustré, lumière chaleureuse.";
const TEEN_STYLE = "Illustration semi-réaliste, ambiance cinéma, lumière travaillée, couleurs riches.";

/** Rules added to every prompt: the image goes into cards and the PDF. */
export const IMAGE_RULES = "Format paysage 4:3. Aucun texte, aucune lettre, aucune bulle dans l'image.";

/**
 * Style line of an age group.
 * @param {string} [ageGroup] - "2-3", "4-6", "7-9", "10-12", "13-15", "16-18".
 * @returns {string}
 */
export const imageStyle = (ageGroup) => {
  const youngest = parseInt(String(ageGroup ?? ''), 10);
  if (Number.isNaN(youngest) || youngest <= 6) return YOUNG_STYLE;
  if (youngest <= 12) return CHILD_STYLE;
  return TEEN_STYLE;
};

/**
 * Short code of a story, written in the name of its image file ("IMG-7f3a2c91").
 * @param {string} storyId
 * @returns {string}
 */
export const imageCode = (storyId) => `IMG-${String(storyId).replace(/-/g, '').slice(0, CODE_LENGTH).toLowerCase()}`;

/**
 * Complete prompt to paste: style of the age group, description of the story, fixed rules.
 * @param {{illustration_prompt?: string|null, age_group?: string}} story
 * @returns {string} Empty when the story has no description yet.
 */
export const buildImagePrompt = (story) => {
  const description = String(story.illustration_prompt ?? '').trim();
  if (!description) return '';
  return [imageStyle(story.age_group), description, IMAGE_RULES].join('\n\n');
};

/**
 * Cleans the description written by the AI: no surrounding quotes, no "Illustration :" label, no markdown.
 * @param {string} text
 * @returns {string}
 */
export const cleanIllustrationPrompt = (text) => String(text ?? '')
  .replace(/\*\*/g, '')
  .trim()
  .replace(/^(?:prompt d'illustration|description de l'illustration|illustration)\s*:\s*/i, '')
  .replace(/^["«“]\s*/, '')
  .replace(/\s*["»”]$/, '')
  .replace(/\s+/g, ' ')
  .trim();

/** Instructions given to the AI to describe the illustration of an existing story. */
export const ILLUSTRATION_PROMPT_SYSTEM = [
  "Tu es directeur artistique de livres pour enfants.",
  "On te donne une histoire. Décris en français UNE illustration qui la représente, pour un générateur d'images.",
  "Décris : la scène la plus marquante, les personnages (âge, apparence, vêtements, expressions), l'action, le décor, la lumière, les couleurs et le cadrage.",
  "Entre 80 et 120 mots, en un seul paragraphe de texte simple, sans titre, sans guillemets, sans liste.",
  "Ne mets aucun texte à écrire dans l'image."
].join('\n');

/**
 * Story given to the AI: title and plain text, trimmed to keep the call small.
 * @param {{title: string, content: string, age_group?: string}} story
 * @returns {string}
 */
export const buildIllustrationRequest = (story) => {
  const text = String(story.content ?? '')
    .replace(/<\/p>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\[Illustration:[^\]]*\]/gi, '')
    .trim()
    .slice(0, 6000);
  const header = [`Titre : ${story.title}`];
  if (story.age_group) header.push(`Public : ${story.age_group} ans`);
  return `${header.join('\n')}\n\n${text}`;
};

/**
 * Text file of the prompts, grouped by week and series, with how to use it.
 * @param {Array<Object>} items - Rows of the illustration list (code, title, week_number, day_order, age_group, imagePrompt).
 * @returns {string}
 */
export const buildPromptsText = (items) => {
  const lines = [
    "PROMPTS D'ILLUSTRATION",
    '',
    "1. Copiez un bloc (sous la ligne du code) dans votre outil d'image : Gemini, ChatGPT, Copilot...",
    "   Faites une semaine dans la même conversation : les personnages restent ressemblants.",
    "2. Rattachez l'image dans l'appli, page Illustrations : collez-la (Ctrl+V) sur sa ligne,",
    "   ou importez plusieurs fichiers : un fichier dont le nom contient le code (ex. IMG-7f3a2c91.png)",
    "   va à son histoire, les autres sont proposés dans l'ordre de ce fichier.",
    ''
  ];
  let group = null;
  for (const item of items) {
    const key = `${item.week_number}|${item.age_group}|${item.series_id ?? ''}`;
    if (key !== group) {
      group = key;
      lines.push('', `======== Semaine ${item.week_number ?? '?'} · ${item.age_group} ans ========`);
    }
    const day = DAY_NAMES[Number(item.day_order) - 1];
    lines.push('', `${item.code} · ${day ?? '—'} — ${item.title}`);
    lines.push(item.imagePrompt || "(prompt à créer : bouton « Créer le prompt » dans la page Illustrations)");
  }
  return `${lines.join('\n')}\n`;
};

/**
 * JSON for the Gemini Canvas tool (public/tools/canvas-illustrations.html).
 * Stories without a prompt are left out: there is nothing to draw yet.
 * @param {Array<Object>} items
 * @returns {Array<{code: string, title: string, week: number, day: string, age: string, prompt: string}>}
 */
export const buildPromptsJson = (items) => items
  .filter(item => item.imagePrompt)
  .map(item => ({
    code: item.code,
    title: item.title,
    week: item.week_number,
    day: DAY_NAMES[Number(item.day_order) - 1] ?? '',
    age: item.age_group,
    prompt: item.imagePrompt
  }));
