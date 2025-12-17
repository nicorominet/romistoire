import dotenv from 'dotenv';
import { logger } from './logger.service.js';
dotenv.config();

// Models configuration with fallback priority
const MODELS = [
  'gemma-3-27b-it',
  'gemma-3-12b',
  'gemma-3-4b',
  'gemma-3-2b',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

/**
 * Adds a WAV header to raw PCM data.
 * @param {Buffer} pcmData - Raw PCM data.
 * @param {number} sampleRate - Sample rate in Hz (default 24000).
 * @param {number} numChannels - Number of channels (default 1).
 * @param {number} bitDepth - Bit depth (default 16).
 * @returns {Buffer} Buffer with WAV header and PCM data.
 */
function addWavHeader(pcmData, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
    const header = Buffer.alloc(44);
    const byteRate = (sampleRate * numChannels * bitDepth) / 8;
    const blockAlign = (numChannels * bitDepth) / 8;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    // RIFF identifier
    header.write('RIFF', 0);
    // File size - 8
    header.writeUInt32LE(fileSize, 4);
    // WAVE identifier
    header.write('WAVE', 8);
    // fmt chunk identifier
    header.write('fmt ', 12);
    // fmt chunk size
    header.writeUInt32LE(16, 16);
    // Audio format (1 = PCM)
    header.writeUInt16LE(1, 20);
    // Number of channels
    header.writeUInt16LE(numChannels, 22);
    // Sample rate
    header.writeUInt32LE(sampleRate, 24);
    // Byte rate
    header.writeUInt32LE(byteRate, 28);
    // Block align
    header.writeUInt16LE(blockAlign, 32);
    // Bits per sample
    header.writeUInt16LE(bitDepth, 34);
    // data chunk identifier
    header.write('data', 36);
    // Data size
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
}

/**
 * Service for interacting with Google Gemini API to generate content.
 */
class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
  }

  /**
   * Generates a story based on provided parameters using Gemini/Gemma.
   * @param {Object} params - Generation parameters.
   * @param {string} params.theme - The weekly theme.
   * @param {string} params.age - The target age group (e.g., "4-6 ans").
   * @param {string} [params.day] - The day of the week or "Toute la semaine".
   * @param {number} [params.numCharacters] - Number of main characters.
   * @param {string} [params.charNames] - Names of main characters.
   * @param {string} [params.seriesName] - Name of the series if part of one.
   * @returns {Promise<{text: string}>} The generated story text and metadata.
   * @throws {Error} If API key is missing or generation fails.
   */
  async generateStory({ theme, age, day, numCharacters, charNames, seriesName }) {
    if (!this.apiKey) {
      throw new Error("Gemini API Key not configured.");
    }

    let prompt = "";
    let illustrationStyle = "";
    let storyStyle = "";
    let wordCount = "";

    // Prompt construction logic (Refactored/Copied from postRoutes.js)
    let characterPrompt = "";
    if (numCharacters && numCharacters > 0) {
        characterPrompt += `Le nombre de personnages principaux dans l'histoire doit être de ${numCharacters}. `;
    }
    if (charNames) {
        characterPrompt += `Les noms des personnages principaux sont : ${charNames}. `;
    }
    
    let seriesContext = "";
    if (seriesName) {
        seriesContext = `Cette histoire fait partie de la série intitulée "${seriesName}". Assurez-vous qu'elle s'intègre bien dans cet univers. `;
    }

    if (age === "2-3 ans") {
        illustrationStyle = "La description doit être très colorée, joyeuse, avec des personnages mignons et des scènes simples, comme un dessin animé pour jeunes enfants. Utilisez des mots simples et concrets.";
        storyStyle = "Le langage doit être très simple, les phrases courtes, et le ton enjoué, adapté aux tout-petits. L'histoire doit être très facile à comprendre et axée sur des concepts basiques.";
        wordCount = "environ 250-300 mots";
    } else if (age === "4-6 ans") {
        illustrationStyle = "La description doit être très colorée, joyeuse, avec des personnages mignons et des scènes simples, comme un dessin animé pour jeunes enfants. Utilisez des mots simples et concrets.";
        storyStyle = "Le langage doit être très simple, les phrases courtes, et le ton enjoué, adapté aux tout-petits. L'histoire doit être très facile à comprendre et axée sur des concepts basiques.";
        wordCount = "environ 300-400 mots";
    } else if (age === "7-9 ans") {
        illustrationStyle = "La description doit être plus détaillée, réaliste mais toujours imaginative, pouvant inclure des textures, des lumières spécifiques, et des éléments d'ambiance. Le style doit être adapté à des illustrations de livres pour enfants plus âgés, avec plus de profondeur.";
        storyStyle = "Le langage peut être plus riche, avec des phrases plus complexes et des concepts plus élaborés, tout en restant engageant et compréhensible pour cette tranche d'âge. Le ton peut être plus narratif et descriptif.";
        wordCount = "environ 500-700 mots";
    } else if (age === "10-12 ans") {
        illustrationStyle = "La description doit être plus détaillée, réaliste mais toujours imaginative, pouvant inclure des textures, des lumières spécifiques, et des éléments d'ambiance. Le style doit être adapté à des illustrations de livres pour enfants plus âgés, avec plus de profondeur.";
        storyStyle = "Le langage peut être plus riche, avec des phrases plus complexes et des concepts plus élaborés, tout en restant engageant et compréhensible pour cette tranche d'âge. Le ton peut être plus narratif et descriptif.";
        wordCount = "environ 800-1000 mots";
    } else if (age === "13-15 ans") {
        illustrationStyle = "La description doit être trés détaillée, réaliste mais un peu moins imaginative, pouvant inclure des textures, des lumières spécifiques, et des éléments d'ambiance et des concepts un peu compliqués. Le style doit être adapté à des illustrations de livres pour adolescent plus âgés, avec plus de profondeur.";
        storyStyle = "Le langage peut être plus riche, avec des phrases plus complexes et des concepts plus élaborés, tout en restant engageant et compréhensible pour cette tranche d'âge. Le ton peut être plus narratif et descriptif.";
        wordCount = "environ 1000-1200 mots";
    } else if (age === "16-18 ans") {
        illustrationStyle = "La description doit être trés détaillée, réaliste est scientifiques, pouvant inclure des textures, des lumières spécifiques, et des éléments d'ambiance et des concepts compliqués. Le style doit être adapté à des illustrations de livres pour adultes, avec plus de profondeur et de la reflexion à avoir.";
        storyStyle = "Le langage doit être plus riche, avec des phrases  complexes et des concepts  élaborés, tout en restant engageant et compréhensible pour des jeunes adultes. Le ton doit etre descript et narratif sans etre edulcoré";
        wordCount = "environ 1200-1400 mots";
    }

    if (day === "Toute la semaine") {
        prompt = `Génère une série d'histoires éducatives pour enfants pour toute une semaine (Lundi à Dimanche) en respectant les critères suivants :
        Contexte : Vous êtes une IA experte en création de contenu éducatif pour enfants. Votre mission est de générer des histoires interactives et engageantes, conformément aux spécifications d'une plateforme éducative locale. L'objectif est de promouvoir la découverte de thèmes scientifiques et naturels, avec une approche ludique et adaptée à l'âge.
        Tâche : Générez une série d'histoires pour enfants, en respectant les critères suivants pour chaque histoire et pour la série complète.
        Critères de Génération pour Chaque Histoire :
        Thème :
        Thème hebdomadaire : "${theme}". Le thème doit être lié à un événement calendaire ou à une saison si pertinent (ex: "L'Automne des Feuilles", "Les Oiseaux du Printemps").
        Fil conducteur : Chaque histoire doit s'inscrire dans une continuité narrative avec les autres histoires de la semaine.
        Tranche d'Âge : "${age}".
        Style du texte : ${storyStyle}
        ${characterPrompt}
        ${seriesContext}
        Structure Narrative :
        Titre : Un titre captivant et pertinent.
        Longueur : Chaque histoire doit faire ${wordCount}.
        Contenu : Intégrez des concepts scientifiques ou naturels de manière simple et compréhensible. Utilisez un vocabulaire approprié et des phrases claires.
        Illustrations : Pour chaque histoire, proposez **une seule description d'illustration**. Cette description doit être **très détaillée et exhaustive**, décrivant précisément la scène, les personnages, l'ambiance, les couleurs, et tout élément pertinent pour une image riche. Pour les histoires de la semaine, assurez-vous que la description de l'illustration de chaque jour maintient une **continuité visuelle et thématique, ainsi qu'une topologie similaire**, avec les jours précédents, créant un fil conducteur visuel pour toute la semaine. (Exemple détaillé : "[Illustration: Un petit escargot souriant, avec des yeux brillants et des antennes joyeuses, glissant lentement sur une grande feuille de nénuphar vert vif, couverte de gouttelettes de pluie scintillantes. Le soleil du matin filtre à travers les feuilles, créant des reflets dorés sur l'eau et la coquille de l'escargot. L'arrière-plan est un étang calme avec des fleurs de lotus roses floues, dans un style enfantin et joyeux.]"). ${illustrationStyle}
        "Cliffhanger" : Pour les histoires du lundi au jeudi, terminez l'histoire par un élément de suspense ou une question qui incite à lire la suite le lendemain.
        Spécificité pour l'Histoire du Vendredi :
        L'histoire du vendredi doit inclure une mention claire d'une activité pour le week-end en lien direct avec le thème de la semaine (ex: "Et si ce week-end, nous allions observer les papillons dans le jardin ?"). Cette activité doit encourager l'exploration pratique.
        Spécificité pour les Histoires du Samedi et Dimanche :
        Les histoires du samedi et du dimanche doivent conclure le thème de la semaine et peuvent inclure des récapitulatifs ou des idées d'activités supplémentaires liées au thème. Elles ne nécessitent pas de cliffhanger.
        Critères de Sortie (Format) :
        Pour chaque histoire, la sortie doit être formatée de la manière suivante, et toutes les histoires doivent être concaténées dans la réponse :
        **Titre de l'Histoire :** [Titre de l'histoire]
        **Thème Hebdomadaire :** [Thème scientifique ou naturel de la semaine]
        **Tranche d'Âge :** [Tranche d'âge ciblée]
        **Jour de la Semaine :** [Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche]
        **Thèmes Associés (JSON):** Génère un tableau JSON de 1 ou 2 objets, où chaque objet représente un thème associé à l'histoire. Chaque objet doit avoir les propriétés suivantes : "name" (string, le nom du thème, ex: "Nature", "Amitié"), "description" (string, une courte description du thème), "icon" (string, une icône emoji pertinente pour le thème, ex: "🌿", "🤝"), et "color" (string, un code couleur hexadécimal pour le thème, ex: "#4CAF50", "#FFC107"). Exemple: [{"name": "Nature", "description": "Exploration du monde naturel", "icon": "🌿", "color": "#4CAF50"}, {"name": "Amitié", "description": "Les liens entre amis", "icon": "🤝", "color": "#FFC107"}]

        [Paragraphe 1 de l'histoire]
        [Description de l'illustration 1]

        ...

        [Dernier paragraphe de l'histoire, incluant le cliffhanger ou l'activité du week-end]
        `;
    } else {
        prompt = `Génère une histoire éducative pour enfants en respectant les critères suivants :
        Contexte : Vous êtes une IA experte en création de contenu éducatif pour enfants. Votre mission est de générer des histoires interactives et engageantes, conformément aux spécifications d'une plateforme éducative locale. L'objectif est de promouvoir la découverte de thèmes scientifiques et naturels, avec une approche ludique et adaptée à l'âge.
        Tâche : Générez une histoire pour enfants, en respectant les critères suivants :
        Thème :
        Thème hebdomadaire : "${theme}". Le thème doit être lié à un événement calendaire ou à une saison si pertinent (ex: "L'Automne des Feuilles", "Les Oiseaux du Printemps").
        Fil conducteur : Cette histoire doit s'inscrire dans une continuité narrative avec les autres histoires de la semaine.
        Tranche d'Âge : "${age}".
        Style du texte : ${storyStyle}
        ${characterPrompt}
        ${seriesContext}
        Structure Narrative :
        Titre : Un titre captivant et pertinent.
        Longueur : L'histoire doit faire ${wordCount}.
        Contenu : Intégrez des concepts scientifiques ou naturels de manière simple et compréhensible. Utilisez un vocabulaire approprié et des phrases claires.
        Illustrations : Pour cette histoire, proposez **une seule description d'illustration**. Cette description doit être **très détaillée et exhaustive**, décrivant précisément la scène, les personnages, l'ambiance, les couleurs, et tout élément pertinent (ex: "[Illustration: Un petit escargot souriant, avec des yeux brillants et des antennes joyeuses, glissant lentement sur une grande feuille de nénuphar vert vif, couverte de gouttelettes de pluie scintillantes. Le soleil du matin filtre à travers les feuilles, créant des reflets dorés sur l'eau et la coquille de l'escargot.]"). ${illustrationStyle}
        "Cliffhanger" : Pour les histoires du lundi au jeudi, terminez l'histoire par un élément de suspense ou une question qui incite à lire la suite le lendemain.
        Spécificité pour l'Histoire du Vendredi :
        Si le jour est Vendredi, l'histoire doit inclure une mention claire d'une activité pour le week-end en lien direct avec le thème de la semaine (ex: "Et si ce week-end, nous allions observer les papillons dans le jardin ?"). Cette activité doit encourager l'exploration pratique.
        Spécificité pour les Histoires du Samedi et Dimanche :
        Si le jour est Samedi ou Dimanche, l'histoire doit conclure le thème de la semaine et peut inclure des récapitulatifs ou des idées d'activités supplémentaires liées au thème. Elle ne nécessite pas de cliffhanger.
        Critères de Sortie (Format) :
        La sortie doit être formatée de la manière suivante :
        **Titre de l'Histoire :** [Titre de l'histoire]
        **Thème Hebdomadaire :** [Thème scientifique ou naturel de la semaine]
        **Tranche d'Âge :** [Tranche d'âge ciblée]
        **Jour de la Semaine :** [Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche]
        **Thèmes Associés (JSON):** Génère un tableau JSON de 1 ou 2 objets, où chaque objet représente un thème associé à l'histoire. Chaque objet doit avoir les propriétés suivantes : "name" (string, le nom du thème, ex: "Nature", "Amitié"), "description" (string, une courte description du thème), "icon" (string, une icône emoji pertinente pour le thème, ex: "🌿", "🤝"), et "color" (string, un code couleur hexadécimal pour le thème, ex: "#4CAF50", "#FFC107"). Exemple: [{"name": "Nature", "description": "Exploration du monde naturel", "icon": "🌿", "color": "#4CAF50"}, {"name": "Amitié", "description": "Les liens entre amis", "icon": "🤝", "color": "#FFC107"}]

        [Paragraphe 1 de l'histoire]
        [Description de l'illustration 1]

        ...

        [Dernier paragraphe de l'histoire, incluant le cliffhanger ou l'activité du week-end]

        Jour de la Semaine : ${day}
        `;
    }

    const makeRequestWithRetry = async (retries = 3, delay = 2000, modelIndex = 0) => {
        const currentModel = MODELS[modelIndex];
        // If we ran out of models, throw final error
        if (!currentModel) {
             throw new Error("All Gemini/Gemma models are overloaded or unavailable.");
        }

        try {
            console.log(`Using AI Model: ${currentModel}`);
            const response = await fetch(`${this.baseUrl}/${currentModel}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                 console.warn(`AI Model Error ${response.status} on model ${currentModel}.`);
                 
                 // If error, try next model immediately (fallback strategy)
                 console.warn(`Switching to next model...`);
                 return makeRequestWithRetry(3, 2000, modelIndex + 1);
            }

            return response;
        } catch (error) {
             // Catch network errors and try next model
             console.error(`Network error on model ${currentModel}: ${error.message}`);
             return makeRequestWithRetry(3, 2000, modelIndex + 1);
        }
    };

    const response = await makeRequestWithRetry();

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("Empty response from Gemini");

    return { text };
  }

  /**
   * Generates audio for a given text using Gemini.
   * @param {string} text - The text to convert to audio.
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string}>} The audio file buffer and mime type.
   */
  async generateAudio(text) {
    if (!this.apiKey) {
      throw new Error("Gemini API Key not configured.");
    }
    
    // Models that support Audio Generation
    const AUDIO_MODELS = [
        'gemini-2.5-flash-preview-tts', // Specialized TTS model
        'gemini-2.0-flash-exp', // Fallback
    ];

    const makeAudioRequestWithRetry = async (retries = 3, delay = 2000, modelIndex = 0) => {
        const currentModel = AUDIO_MODELS[modelIndex];
        if (!currentModel) {
             // If we exhausted models, throw a descriptive error
             throw new Error("All Audio models are unavailable or overloaded (Quota Exceeded). Please try again later.");
        }

        try {
            console.log(`Attempting audio generation with model: ${currentModel}`);
            const url = `${this.baseUrl}/${currentModel}:generateContent?key=${this.apiKey}`;
            
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: `Please read the following story aloud with a narrator's voice suitable for children:\n\n${text}` }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"]
                }
              })
            });

            if (!response.ok) {
                 const errText = await response.text();
                 console.error(`Audio Model Error ${response.status} on ${currentModel}: ${errText}`);
                 
                 // On error (429, 503, 404), switch to next model
                 console.warn(`Switching to next audio model...`);
                 return makeAudioRequestWithRetry(3, 2000, modelIndex + 1);
            }

            return response;
        } catch (error) {
             console.error(`Network error on audio model ${currentModel}: ${error.message}`);
             return makeAudioRequestWithRetry(3, 2000, modelIndex + 1);
        }
    };

    const response = await makeAudioRequestWithRetry();
    const result = await response.json();
    
    const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData && (p.inlineData.mimeType.startsWith('audio/') || p.inlineData.mimeType === 'audio/mp3'));
    
    if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
        console.error("No audio content in response:", JSON.stringify(result, null, 2));
        throw new Error("No audio generated by Gemini.");
    }

    const rawAudioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
    // Gemini 2.5 Flash Preview TTS returns raw PCM (24kHz, mono, 16-bit)
    // We need to add a WAV header to make it playable.
    const wavBuffer = addWavHeader(rawAudioBuffer);

    return {
        audioBuffer: wavBuffer,
        mimeType: 'audio/wav'
    };
  }


}



export const geminiService = new GeminiService();
