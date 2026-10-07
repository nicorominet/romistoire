
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;

/**
 * Fetches every page of the models list (the API paginates, 50 per page by default).
 */
async function fetchAllModels() {
  const models = [];
  let pageToken = '';
  do {
    const url = `${baseUrl}?key=${apiKey}&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    models.push(...(data.models || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return models;
}

async function listModels() {
  if (!apiKey) {
    console.error("No API KEY found");
    return;
  }
  console.log("Fetching models...");
  try {
    const models = await fetchAllModels();
    if (models.length === 0) {
        console.log("No models returned by the API");
        return;
    }
    console.log(`Available Models: ${models.length}`);
    const fs = await import('fs');
    const content = models.map(m => `- ${m.name} (Supported methods: ${m.supportedGenerationMethods})`).join('\n');
    fs.writeFileSync(path.join(__dirname, 'models.txt'), content);
    console.log("Models written to scripts/models.txt");

    // Flag configured models (server/services/gemini.service.js or GEMINI_MODELS / GEMINI_AUDIO_MODELS) that no longer exist
    const { MODELS, AUDIO_MODELS } = await import('../server/services/gemini.service.js');
    const available = new Set(models
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, '')));
    for (const [label, configured] of [['Story', MODELS], ['Audio', AUDIO_MODELS]]) {
        const missing = configured.filter(model => !available.has(model));
        console.log(missing.length === 0
            ? `${label} models: all ${configured.length} configured models are available.`
            : `${label} models: NOT AVAILABLE -> ${missing.join(', ')}`);
    }
  } catch (error) {
    console.error("Failed to list models:", error);
  }
}

listModels();
