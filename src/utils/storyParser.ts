/**
 * Utility for parsing AI-generated story text.
 * Handles segmentation, metadata extraction (themes, illustrations), and content cleaning.
 */

export interface ParsedStory {
  title: string;
  content: string;
  associatedThemes: any[];
  dayOfWeek?: string;
  illustrationDescription: string;
}

/**
 * Splits raw AI response into individual story segments.
 */
export const splitStorySegments = (rawText: string, isWeekly: boolean): string[] => {
  if (!isWeekly) return [rawText];

  // Robust Splitter: 
  // 1. Matches **Titre de l'Histoire :
  // 2. Matches Titre de l'Histoire : (no bold)
  // 3. Matches **Titre :
  const segments = rawText.split(/(?=(?:\*\*?|)?Titre(?: de l'Histoire)?\s*:)/gi).filter(s => s.trim() !== '');
  
  // Clean conversational filler at the start (Gemma 3 chatter)
  const conversationalPrefix = /^(?:Okay|D'accord|Voici|Sure|Here is|Je peux|Bien s[uû]r).*?(?:\n)/is;
  if (segments.length === 1 && segments[0].match(conversationalPrefix)) {
      if (segments[0].match(/Titre\s*:/i)) {
          segments[0] = segments[0].replace(conversationalPrefix, '');
      }
  }

  // Pre-clean: Remove wrapping parentheses or Day Name prefixes often added by Local LLM
  const dayNamesPattern = "Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche";
  const prefixRegex = new RegExp(`^\\s*(?:voici|voivi)?\\s*(?:le)?\\s*(?:${dayNamesPattern})?\\s*[\\(:\\-]?`, 'i');
  const endParenthesisRegex = /\)\s*$/;

  return segments.map(segment => {
      let cleaned = segment;
      const match = cleaned.match(prefixRegex);
      if (match && match[0].length > 0 && match[0].length < 50) {
          cleaned = cleaned.substring(match[0].length);
      }
      if (cleaned.match(endParenthesisRegex) && !cleaned.includes('(')) {
          cleaned = cleaned.replace(endParenthesisRegex, '');
      }
      return cleaned.trim();
  });
};

/**
 * Extracts metadata and cleans content for a single story segment.
 */
export const parseStorySegment = (segment: string): ParsedStory => {
  // 1. Extract Title
  let titleMatch = segment.match(/(?:\*\*?)?Titre(?:\s*de\s*l['’]Histoire)?\s*:?(?:\*\*?)?\s*(.*?)(\n|$)/i);
  let title = titleMatch ? titleMatch[1].trim() : "";

  if (!title) {
    const firstLine = segment.split('\n')[0].trim();
    if (firstLine.length > 2 && firstLine.length < 100 && !firstLine.includes(':')) {
      title = firstLine;
    } else {
      title = "Histoire Générée";
    }
  }

  // 2. Extract Themes (JSON or list)
  let associatedThemes: any[] = [];
  let themesToRemove: string[] = [];

  // Strategy 1: Header + JSON
  const themesJsonHeaderRegex = /\*\*Thèmes Associés \(JSON\):\*\*/i;
  const jsonBlockRegex = /(\[[\s\S]*?\])/;
  const headerMatch = segment.match(themesJsonHeaderRegex);
  if (headerMatch) {
    const textAfterHeader = segment.substring(headerMatch.index! + headerMatch[0].length);
    const jsonMatch = textAfterHeader.match(jsonBlockRegex);
    if (jsonMatch) {
      try {
        associatedThemes = JSON.parse(jsonMatch[1]);
        themesToRemove.push(jsonMatch[1]);
      } catch (e) { console.warn("Failed to parse themes JSON (Header)", e); }
    }
  }

  // Strategy 2: Scan for any JSON array
  if (associatedThemes.length === 0) {
    const searchHorizon = segment.substring(0, 3000);
    // Safer regex: ensure it starts with [{ to avoid matching [Illustration...]
    const jsonArrayMatch = searchHorizon.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
    if (jsonArrayMatch) {
      try {
        const parsed = JSON.parse(jsonArrayMatch[1]);
        if (Array.isArray(parsed)) {
          associatedThemes = parsed;
          themesToRemove.push(jsonArrayMatch[1]);
        }
      } catch (e) { console.warn("Found possible JSON block but failed to parse", e); }
    }
  }

  // Strategy 3: Loose objects
  if (associatedThemes.length === 0) {
    const looseObjectRegex = /\{[^{}]*?"name"[^{}]*?\}/g;
    const matches = segment.match(looseObjectRegex);
    if (matches && matches.length > 0) {
      try {
        associatedThemes = JSON.parse(`[${matches.join(',')}]`);
      } catch (e) { console.warn("Failed to parse loose objects", e); }
    }
  }

  // Strategy 4: Text list
  if (associatedThemes.length === 0) {
    const themesTextRegex = /\*\*Thèmes Associés :\*\* (.*?)(\n|$)/;
    const themesTextMatch = segment.match(themesTextRegex);
    if (themesTextMatch) {
      associatedThemes = themesTextMatch[1].split(',').map(t => ({ name: t.trim() })).filter(t => t.name !== '');
      themesToRemove.push(themesTextMatch[0]);
    }
  }

  // 3. Extract Illustration
  const illustrationRegex = /\[\s*(?:Illustration|Description)(?:\s*\d+)?\s*:?\s*([\s\S]*?)\]/i;
  const descriptionRegex = /(?:^|\n)\s*(?:\*\*?)?(?:Description(?:\s*de\s*l['’]illustration)?|Illustration|L['’]illustration(?:\s*doit\s*représente[r])?)\s*(?:\d+)?\s*:?(?:\*\*?)?\s*(.*?)(?:\n|$)/i;
  
  let illuMatch = segment.match(illustrationRegex) || segment.match(descriptionRegex);
  let illustrationDescription = illuMatch ? illuMatch[1].trim() : '';

  // 4. Extract Day of week
  const dayOfWeekMatch = segment.match(/\*\*Jour de la Semaine :\*\* (.*?)(\n|$)/);

  // 5. Clean Content
  let content = segment;

  // Strip JSON-like lines
  content = content.replace(/\{"name":\s*"[^"]*".*?\}.*$/gm, '');
  content = content.replace(/^\s*[\[\],{}]\s*$/gm, '');

  // Strip Markdown Code Blocks
  content = content.replace(/^```[a-z]*\s*$/gm, '').replace(/^```\s*$/gm, '');

  // Strip Metadata Headers (relaxed matching)
  const metadataRegexes = [
      /(?:\(?\*\*?)?Titre de l'Histoire\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
      /(?:\(?\*\*?)?Thème Hebdomadaire\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
      /(?:\(?\*\*?)?Thème\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
      /(?:\(?\*\*?)?Séries?\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
      /(?:\(?\*\*?)?Tranche d['’]Âge\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
      /(?:\(?\*\*?)?Jour de la Semaine\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
      /(?:\(?\*\*?)?Thèmes Associés \(JSON\)\s*:?\**\)?\s*(.*?)(?:\n|$)/i,
      /(?:\(?\*\*?)?(?:Description(?:\s*de\s*l['’]illustration)?|Illustration)\s*\d*\s*:?\**\)?\s*(.*?)(?:\n|$)/i
  ];

  metadataRegexes.forEach(regex => {
      // Use a loop to replace ALL occurrences, not just the first one
      let match;
      while ((match = content.match(regex)) !== null) {
          content = content.replace(match[0], '');
      }
  });

  if (titleMatch) content = content.replace(titleMatch[0], '');
  themesToRemove.forEach(t => { content = content.replace(t, ''); });

  // Remove loose JSON objects leftovers
  const jsonObjectRegex = /\{[\s\n]*"name"[\s\S]*?\}[\s\n]*/g;
  content = content.replace(jsonObjectRegex, '');
  content = content.replace(/\s*}\s*,\s*{\s*/g, ' '); 
  content = content.replace(/\s*}\s*}\s*$/gm, '');
  content = content.replace(/^\s*[\[\],{}]\s*$/gm, ''); 
  content = content.replace(/^\s*},?\s*$/gm, '');
  content = content.replace(/```json\s*[\s\S]*?```/g, '');
  content = content.replace(/^\s*\[\s*[\s\S]*?\]\s*$/gm, '');
  content = content.replace(/\[\s*{\s*"name"[\s\S]*?\}\s*\]/g, '');
  content = content.replace(/^\s*"[a-z]+"\s*:\s*.*?,?\s*$/gmi, '');

  // Strip Illustrations
  const bracketMatch = content.match(illustrationRegex);
  if (bracketMatch) content = content.replace(bracketMatch[0], '');

  const descMatch = content.match(descriptionRegex);
  if (descMatch) content = content.replace(descMatch[0], '');

  const emojiIlluMatch = content.match(/🎨\s*(.*?)(?:\n|$)/s);
  if (emojiIlluMatch) {
      content = content.replace(emojiIlluMatch[0], '');
      if (!illustrationDescription) illustrationDescription = emojiIlluMatch[1]; 
  }

  // Paragraph cleaning
  content = content.replace(/^\s*\*\*Paragraphe \d+ de l'histoire:?\*\*\s*$/gm, '');
  content = content.replace(/^\s*Paragraphe \d+ de l'histoire:?\s*$/gm, '');

  content = content.trim();
  content = content.replace(/\n{3,}/g, '\n\n');

  if (illustrationDescription) {
      content += `\n\n> **Illustration suggérée :** ${illustrationDescription.trim()}`;
  }

  return {
    title,
    content,
    associatedThemes,
    dayOfWeek: dayOfWeekMatch ? dayOfWeekMatch[1].trim() : undefined,
    illustrationDescription
  };
};
