/**
 * Output schema shared by every story generation provider.
 * The model answers with { "stories": [ ... ] }, one entry per generated story.
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
          themes: {
            type: 'ARRAY',
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
