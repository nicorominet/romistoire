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
 * Builds a regex matching a whole metadata line such as "**Thème Hebdomadaire :** Pluie".
 * Anchored at line start and requiring the colon, so story sentences that merely
 * contain the word ("Le thème du jour...") are never touched.
 */
const metadataLine = (label: string, flags = "gim") =>
  new RegExp(`^[ \\t>]*\\(?\\**[ \\t]*(?:${label})[ \\t]*\\**[ \\t]*:[^\\n]*(?:\\n|$)`, flags);

const TITLE_LABEL = "Titre(?:[ \\t]+de[ \\t]+l['’]Histoire)?";
const DAY_LABEL = "Jour[ \\t]+de[ \\t]+la[ \\t]+Semaine";
const ILLUSTRATION_LABEL = "(?:Description(?:[ \\t]+de[ \\t]+l['’]illustration)?|Illustration(?:[ \\t]+sugg[ée]r[ée]e)?)(?:[ \\t]*\\d+)?";

const METADATA_LABELS = [
  TITLE_LABEL,
  "Th[èe]mes?(?:[ \\t]+Hebdomadaire|[ \\t]+Associ[ée]s(?:[ \\t]*\\(JSON\\))?)?",
  "S[ée]ries?",
  "Tranche[ \\t]+d['’][ÂA]ge",
  DAY_LABEL,
];

/** Captures the value of a metadata line: "**Label :** value" -> "value". */
const metadataValue = (label: string) =>
  new RegExp(`^[ \\t>]*\\(?\\**[ \\t]*(?:${label})[ \\t]*\\**[ \\t]*:[ \\t]*\\**[ \\t]*([^\\n]*?)[ \\t]*\\**[ \\t]*\\)?[ \\t]*$`, "im");

const cleanValue = (value: string) =>
  value.replace(/^\[|\]$/g, "").replace(/\*+/g, "").replace(/[\s.,;!]+$/, "").trim();

/**
 * Splits raw AI response into individual story segments.
 */
export const splitStorySegments = (rawText: string, isWeekly: boolean): string[] => {
  if (!isWeekly) return [rawText];

  // Split before each title line (bold or not, "Titre :" or "Titre de l'Histoire :")
  const segments = rawText
    .split(new RegExp(`(?=^[ \\t>]*\\(?\\**[ \\t]*${TITLE_LABEL}[ \\t]*\\**[ \\t]*:)`, "gim"))
    .filter(s => s.trim() !== '');

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
  const titleMatch = segment.match(metadataValue(TITLE_LABEL));
  let title = titleMatch ? cleanValue(titleMatch[1]) : "";

  if (!title) {
    const firstLine = segment.split('\n')[0].trim();
    if (firstLine.length > 2 && firstLine.length < 100 && !firstLine.includes(':')) {
      title = firstLine.replace(/\*+/g, '').replace(/^#+\s*/, '').trim();
    } else {
      title = "Histoire Générée";
    }
  }

  // 2. Extract Themes (JSON or list)
  let associatedThemes: any[] = [];
  const themesToRemove: string[] = [];

  // Strategy 1: Header + JSON
  const themesJsonHeaderRegex = /Th[èe]mes Associ[ée]s\s*\(JSON\)\s*:?\**/i;
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
        themesToRemove.push(...matches);
      } catch (e) { console.warn("Failed to parse loose objects", e); }
    }
  }

  // Strategy 4: Text list
  if (associatedThemes.length === 0) {
    const themesTextMatch = segment.match(metadataValue("Th[èe]mes Associ[ée]s"));
    if (themesTextMatch) {
      associatedThemes = cleanValue(themesTextMatch[1]).split(',').map(t => ({ name: t.trim() })).filter(t => t.name !== '');
    }
  }

  // 3. Extract Day of week (bold or not, with or without space before the colon)
  const dayOfWeekMatch = segment.match(metadataValue(DAY_LABEL));
  const dayOfWeek = dayOfWeekMatch ? cleanValue(dayOfWeekMatch[1]) || undefined : undefined;

  // 4. Clean Content
  let content = segment;

  // Strip theme JSON blocks first (exact strings found above)
  themesToRemove.forEach(t => { content = content.replace(t, ''); });
  content = content.replace(/```json\s*[\s\S]*?```/g, '');
  content = content.replace(/\[\s*{\s*"name"[\s\S]*?\}\s*\]/g, '');
  content = content.replace(/\{[\s\n]*"name"[\s\S]*?\}[\s\n]*/g, '');
  content = content.replace(/^\s*"(?:name|description|icon|color)"\s*:.*$/gmi, '');
  content = content.replace(/^\s*[\[\],{}]+\s*$/gm, '');

  // Strip Markdown Code Blocks
  content = content.replace(/^```[a-z]*\s*$/gm, '');

  // 5. Extract & strip ALL illustration descriptions (bracketed, labelled lines, emoji, block quotes)
  const illustrationDescriptions: string[] = [];
  const collect = (text: string) => {
    const cleaned = text.replace(/\*+/g, '').trim();
    if (cleaned) illustrationDescriptions.push(cleaned);
  };

  content = content.replace(/\[\s*(?:Illustration|Description)(?:\s*\d+)?\s*:?\s*([\s\S]*?)\]/gi, (_, description) => {
    collect(description);
    return '';
  });
  content = content.replace(metadataLine(ILLUSTRATION_LABEL), (line) => {
    collect(line.replace(new RegExp(`^[ \\t>]*\\(?\\**[ \\t]*${ILLUSTRATION_LABEL}[ \\t]*\\**[ \\t]*:`, 'i'), ''));
    return '';
  });
  content = content.replace(/^[ \t]*🎨\s*(.*?)(?:\n|$)/gm, (_, description) => {
    collect(description);
    return '';
  });

  // Strip Metadata Headers (whole lines only)
  METADATA_LABELS.forEach(label => {
      content = content.replace(metadataLine(label), '');
  });

  // Paragraph placeholders echoed from the prompt template
  content = content.replace(/^\s*\**\[?Paragraphe \d+ de l'histoire\]?:?\**\s*$/gm, '');

  content = content.trim();
  content = content.replace(/\n{3,}/g, '\n\n');

  return {
    title,
    content,
    associatedThemes,
    dayOfWeek,
    illustrationDescription: illustrationDescriptions.join('\n\n')
  };
};
