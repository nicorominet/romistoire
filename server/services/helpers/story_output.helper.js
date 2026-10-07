import { PromptHelper } from './prompt.helper.js';

/**
 * Extracts the first complete JSON object or array from a model answer.
 * Tolerates code fences and chatter around the JSON ("Voici l'histoire : {...}").
 * @param {string} text - Raw model answer.
 * @returns {string|null} The JSON substring, or null if none is balanced.
 */
export const extractJson = (text) => {
  const source = String(text || '').replace(/```(?:json)?/gi, '');
  const start = source.search(/[{[]/);
  if (start === -1) return null;

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      const open = stack.pop();
      if ((char === '}' && open !== '{') || (char === ']' && open !== '[')) return null;
      if (stack.length === 0) return source.slice(start, i + 1);
    }
  }
  return null;
};

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeThemes = (themes) => (Array.isArray(themes) ? themes : [])
  .filter(theme => theme && asText(theme.name))
  .map(theme => ({
    name: asText(theme.name),
    description: asText(theme.description),
    icon: asText(theme.icon),
    color: /^#[0-9a-f]{3,8}$/i.test(asText(theme.color)) ? asText(theme.color) : undefined
  }));

const normalizeParagraphs = (story) => {
  if (Array.isArray(story.paragraphs)) {
    return story.paragraphs.map(asText).filter(Boolean);
  }
  // Some models put the whole text in "content" or "text"
  const text = asText(story.paragraphs) || asText(story.content) || asText(story.text);
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
};

/**
 * Parses and normalizes a structured story answer.
 * @param {string} text - Raw model answer.
 * @returns {Array<{day: string|null, title: string, summary: string, themes: Object[], paragraphs: string[], illustrationPrompt: string}>|null}
 *   Normalized stories, or null when the answer is not usable JSON (caller falls back to the text parser).
 */
export const parseStoryOutput = (text) => {
  const json = extractJson(text);
  if (!json) return null;

  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return null;
  }

  let rawStories;
  if (Array.isArray(data)) rawStories = data;
  else if (Array.isArray(data?.stories)) rawStories = data.stories;
  else if (data?.stories && typeof data.stories === 'object') rawStories = [data.stories];
  else if (data && typeof data === 'object' && (data.title || data.paragraphs)) rawStories = [data];
  else return null;

  const stories = rawStories
    .filter(story => story && typeof story === 'object')
    .map(story => ({
      day: PromptHelper.normalizeDay(story.day),
      title: asText(story.title),
      summary: asText(story.summary),
      themes: normalizeThemes(story.themes),
      paragraphs: normalizeParagraphs(story),
      illustrationPrompt: asText(story.illustration_prompt) || asText(story.illustrationPrompt)
    }))
    .filter(story => story.paragraphs.length > 0);

  return stories.length > 0 ? stories : null;
};
