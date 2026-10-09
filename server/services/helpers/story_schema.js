/**
 * Output schema shared by every story generation provider.
 * The model answers with { "stories": [ ... ] }, one entry per generated story.
 * The first day of a week generated day by day also returns "week_plan": one line per day,
 * so the following days follow the same storyline.
 */

export const STORY_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Gemini `responseSchema` (OpenAPI subset: uppercase types, propertyOrdering).
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    stories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          day: { type: 'STRING', enum: STORY_DAYS },
          title: { type: 'STRING' },
          summary: { type: 'STRING' },
          // 2 or 3 tags: the precise subject of the story, then 1 or 2 values (see PromptHelper.getThemesPrompt)
          themes: {
            type: 'ARRAY',
            minItems: 2,
            maxItems: 3,
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                description: { type: 'STRING' },
                icon: { type: 'STRING' },
                color: { type: 'STRING' }
              },
              required: ['name', 'description', 'icon', 'color'],
              propertyOrdering: ['name', 'description', 'icon', 'color']
            }
          },
          paragraphs: { type: 'ARRAY', items: { type: 'STRING' } },
          illustration_prompt: { type: 'STRING' }
        },
        required: ['day', 'title', 'summary', 'themes', 'paragraphs', 'illustration_prompt'],
        propertyOrdering: ['day', 'title', 'summary', 'themes', 'paragraphs', 'illustration_prompt']
      }
    }
  },
  required: ['stories']
};

/**
 * Standard JSON Schema, used by Ollama's `format` option (constrained decoding).
 */
export const JSON_SCHEMA = {
  type: 'object',
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string', enum: STORY_DAYS },
          title: { type: 'string' },
          summary: { type: 'string' },
          themes: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                icon: { type: 'string' },
                color: { type: 'string' }
              },
              required: ['name', 'description', 'icon', 'color']
            }
          },
          paragraphs: { type: 'array', items: { type: 'string' } },
          illustration_prompt: { type: 'string' }
        },
        required: ['day', 'title', 'summary', 'themes', 'paragraphs', 'illustration_prompt']
      }
    }
  },
  required: ['stories']
};

/** Number of lines of a week plan (Monday to Sunday). */
export const WEEK_PLAN_LENGTH = STORY_DAYS.length;

/**
 * Adapts a base schema: number of stories (7 for a whole week in one answer), minimum number of
 * paragraphs and, for the first day of a week generated day by day, the plan and the character sheets,
 * written before the story.
 * @param {Object} base - GEMINI_RESPONSE_SCHEMA or JSON_SCHEMA.
 * @param {(type: string) => string} type - Type name in the schema dialect.
 */
const buildSchema = (base, type, { withWeekPlan = false, minParagraphs = 0, storyCount = 0 } = {}) => {
  const schema = structuredClone(base);
  if (storyCount > 0) {
    schema.properties.stories.minItems = storyCount;
    schema.properties.stories.maxItems = storyCount;
  }
  if (minParagraphs > 0) schema.properties.stories.items.properties.paragraphs.minItems = minParagraphs;
  if (!withWeekPlan) return schema;

  const characterProperties = { name: { type: type('string') }, description: { type: type('string') } };
  schema.properties = {
    week_plan: { type: type('array'), items: { type: type('string') } },
    characters: {
      type: type('array'),
      items: { type: type('object'), properties: characterProperties, required: ['name', 'description'] }
    },
    ...schema.properties
  };
  schema.required = ['week_plan', 'characters', 'stories'];
  if (base === GEMINI_RESPONSE_SCHEMA) {
    schema.properties.characters.items.propertyOrdering = ['name', 'description'];
    schema.propertyOrdering = ['week_plan', 'characters', 'stories'];
  }
  return schema;
};

/**
 * Gemini schema.
 * @param {{withWeekPlan?: boolean, minParagraphs?: number, storyCount?: number}} [options]
 */
export const geminiResponseSchema = (options = {}) => buildSchema(GEMINI_RESPONSE_SCHEMA, name => name.toUpperCase(), options);

/**
 * JSON Schema (Ollama).
 * @param {{withWeekPlan?: boolean, minParagraphs?: number, storyCount?: number}} [options]
 */
export const jsonSchema = (options = {}) => buildSchema(JSON_SCHEMA, name => name, options);
