
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;

async function listModels() {
  if (!apiKey) {
    console.error("No API KEY found");
    return;
  }
  console.log("Fetching models...");
  try {
    const response = await fetch(`${baseUrl}?key=${apiKey}`);
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    console.log("Available Models:");
    if (data.models) {
        const fs = await import('fs');
        const content = data.models.map(m => `- ${m.name} (Supported methods: ${m.supportedGenerationMethods})`).join('\n');
        fs.writeFileSync(path.join(__dirname, 'models.txt'), content);
        console.log("Models written to scripts/models.txt");
    } else {
        console.log("No models field in response", data);
    }
  } catch (error) {
    console.error("Failed to list models:", error);
  }
}

listModels();
