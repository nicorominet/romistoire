/**
 * Reading voice of the audio stories: Gemini prebuilt voices, narration style and pace,
 * age presets, request bodies of the TTS models and two-voice splitting of a story.
 */
import { PromptHelper } from './prompt.helper.js';

/** Gemini prebuilt voices and their descriptor (translated by the client: settings.ai.voice.traits.<trait>). */
export const VOICES = [
  { name: 'Sulafat', trait: 'warm' },
  { name: 'Vindemiatrix', trait: 'gentle' },
  { name: 'Achernar', trait: 'soft' },
  { name: 'Achird', trait: 'friendly' },
  { name: 'Puck', trait: 'upbeat' },
  { name: 'Laomedeia', trait: 'upbeat' },
  { name: 'Sadachbia', trait: 'lively' },
  { name: 'Leda', trait: 'youthful' },
  { name: 'Aoede', trait: 'breezy' },
  { name: 'Zephyr', trait: 'bright' },
  { name: 'Autonoe', trait: 'bright' },
  { name: 'Fenrir', trait: 'excitable' },
  { name: 'Callirrhoe', trait: 'easyGoing' },
  { name: 'Umbriel', trait: 'easyGoing' },
  { name: 'Zubenelgenubi', trait: 'casual' },
  { name: 'Algieba', trait: 'smooth' },
  { name: 'Despina', trait: 'smooth' },
  { name: 'Enceladus', trait: 'breathy' },
  { name: 'Iapetus', trait: 'clear' },
  { name: 'Erinome', trait: 'clear' },
  { name: 'Schedar', trait: 'even' },
  { name: 'Gacrux', trait: 'mature' },
  { name: 'Sadaltager', trait: 'knowledgeable' },
  { name: 'Charon', trait: 'informative' },
  { name: 'Rasalgethi', trait: 'informative' },
  { name: 'Kore', trait: 'firm' },
  { name: 'Orus', trait: 'firm' },
  { name: 'Alnilam', trait: 'firm' },
  { name: 'Pulcherrima', trait: 'forward' },
  { name: 'Algenib', trait: 'gravelly' }
];
export const VOICE_NAMES = VOICES.map((voice) => voice.name);

// Directions given to the model (English: understood by every TTS model)
const STYLE_DIRECTIONS = {
  storyteller: 'Read like a warm, expressive storyteller, giving life to each character.',
  calm: 'Read in a calm, soft and soothing voice, like a bedtime story for a young child.',
  lively: 'Read in a lively, playful and enthusiastic voice, with clear emotions.',
  dramatic: 'Read with suspense and dramatic intensity, varying the tone to build tension.',
  neutral: 'Read in a natural, clear and engaging voice, like an audiobook narrator.'
};
const PACE_DIRECTIONS = {
  slow: 'Speak slowly, with gentle pauses between sentences.',
  normal: 'Speak at a natural, moderate pace.',
  lively: 'Speak at a brisk, energetic pace.'
};

/** "auto" follows the age group. */
export const STYLES = ['auto', ...Object.keys(STYLE_DIRECTIONS)];
export const PACES = ['auto', ...Object.keys(PACE_DIRECTIONS)];

/** Style and pace of "auto" for each age group. */
export const AGE_PRESETS = {
  '2-3': { style: 'calm', pace: 'slow' },
  '4-6': { style: 'calm', pace: 'slow' },
  '7-9': { style: 'storyteller', pace: 'normal' },
  '10-12': { style: 'storyteller', pace: 'normal' },
  '13-15': { style: 'neutral', pace: 'normal' },
  '16-18': { style: 'neutral', pace: 'normal' }
};
const FALLBACK_PRESET = { style: 'storyteller', pace: 'normal' };

export const DEFAULT_AUDIO = Object.freeze({ voice: 'Sulafat', characterVoice: 'Puck', style: 'auto', pace: 'auto', multiSpeaker: false });

/** Speaker names of a two-voice reading: written in the text sent to the model, never read aloud. */
export const NARRATOR = 'Narrateur';
export const CHARACTERS = 'Personnages';

const FIELD_CHOICES = { voice: VOICE_NAMES, characterVoice: VOICE_NAMES, style: STYLES, pace: PACES };

/**
 * Checks reading options sent by a client. Missing or null fields are left out, unknown fields ignored.
 * @param {Object} [input]
 * @returns {{options: Object, errors: string[]}}
 */
export const validateAudioOptions = (input) => {
  const options = {};
  const errors = [];
  if (!input || typeof input !== 'object') return { options, errors };
  for (const [field, choices] of Object.entries(FIELD_CHOICES)) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (choices.includes(value)) options[field] = value;
    else errors.push(`${field} must be one of ${choices.join(', ')}`);
  }
  if (input.multiSpeaker !== undefined && input.multiSpeaker !== null) {
    if (typeof input.multiSpeaker === 'boolean') options.multiSpeaker = input.multiSpeaker;
    else errors.push('multiSpeaker must be a boolean');
  }
  return { options, errors };
};

const pick = (field, ...sources) => sources.map((source) => source?.[field]).find((value) => value !== undefined && value !== null);

/**
 * Options of one reading: request first, then the saved settings, then the defaults; "auto" style and pace
 * follow the age group.
 * @param {Object} [requested] - Validated options of the request.
 * @param {Object} [saved] - Settings > AI > reading voice (null fields = not set).
 * @param {string} [ageGroup] - "4-6" or "4-6 ans".
 * @returns {{voice: string, characterVoice: string, style: string, pace: string, styleText: string, multiSpeaker: boolean}}
 */
export const resolveAudioOptions = (requested = {}, saved = {}, ageGroup) => {
  const preset = AGE_PRESETS[PromptHelper.normalizeAge(ageGroup)] ?? FALLBACK_PRESET;
  const chosenStyle = pick('style', requested, saved, DEFAULT_AUDIO);
  const style = chosenStyle === 'auto' ? preset.style : chosenStyle;
  const chosenPace = pick('pace', requested, saved, DEFAULT_AUDIO);
  const pace = chosenPace === 'auto' ? preset.pace : chosenPace;
  return {
    voice: pick('voice', requested, saved, DEFAULT_AUDIO),
    characterVoice: pick('characterVoice', requested, saved, DEFAULT_AUDIO),
    style,
    pace,
    styleText: `${STYLE_DIRECTIONS[style]} ${PACE_DIRECTIONS[pace]}`,
    multiSpeaker: pick('multiSpeaker', requested, saved, DEFAULT_AUDIO)
  };
};

// What each TTS model family accepts: Gemini 3+ takes the style apart (speechMetadata), so it is not read aloud;
// older models get it as an instruction before the text. Checked against the API (Oct. 2026): 3.1 Flash TTS
// rejects speechMetadata ("not supported for this model"); 3.8 takes it, with the speaker on each part.
const TTS_CAPABILITIES = [
  { prefix: 'gemini-2.', speechMetadata: false },
  { prefix: 'gemini-3.1-', speechMetadata: false },
  { prefix: 'gemini-', speechMetadata: true }
];
export const getTtsCapabilities = (model) =>
  TTS_CAPABILITIES.find((c) => model.startsWith(c.prefix)) || { speechMetadata: false };

const prebuiltVoice = (voiceName) => ({ prebuiltVoiceConfig: { voiceName } });

/**
 * generateContent body of a reading.
 * @param {string} model
 * @param {string|{speaker: string, text: string}[]} input - Text, or segments of a two-voice reading.
 * @param {{voice: string, characterVoice: string, styleText: string}} resolved
 */
export const buildTtsRequestBody = (model, input, resolved) => {
  const twoVoices = Array.isArray(input);
  const speechConfig = twoVoices
    ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            { speaker: NARRATOR, voiceConfig: prebuiltVoice(resolved.voice) },
            { speaker: CHARACTERS, voiceConfig: prebuiltVoice(resolved.characterVoice) }
          ]
        }
      }
    : { voiceConfig: prebuiltVoice(resolved.voice) };

  let parts;
  if (getTtsCapabilities(model).speechMetadata) {
    // One part per line, each naming its speaker
    parts = twoVoices
      ? input.map(({ speaker, text }) => ({ text, speechMetadata: { speaker, style: resolved.styleText } }))
      : [{ text: input, speechMetadata: { style: resolved.styleText } }];
  } else {
    // "Speaker: line" transcript after the instruction
    const text = twoVoices ? input.map((segment) => `${segment.speaker}: ${segment.text}`).join('\n') : input;
    const intro = twoVoices
      ? `Read the following story aloud. ${NARRATOR} is the narrator and ${CHARACTERS} speaks the lines of the characters.`
      : 'Read the following story aloud.';
    parts = [{ text: `${intro} ${resolved.styleText}\n\n${text}` }];
  }

  return {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig }
  };
};

/** Consecutive segments of the same speaker joined; empty ones dropped. */
const mergeSegments = (segments) =>
  segments.reduce((merged, { speaker, text }) => {
    const clean = text.trim();
    if (!clean) return merged;
    const last = merged[merged.length - 1];
    if (last?.speaker === speaker) last.text = `${last.text} ${clean}`;
    else merged.push({ speaker, text: clean });
    return merged;
  }, []);

// French dialogue lines start with a dash or an opening guillemet
const DIALOGUE_START = /^\s*(?:[—–-]|«)/;

/**
 * Two-voice split without AI: paragraphs starting as a dialogue go to the characters.
 * @param {string} text
 * @returns {{speaker: string, text: string}[]}
 */
export const splitDialogueHeuristic = (text) =>
  mergeSegments(
    text.split(/\n+/).map((paragraph) => ({ speaker: DIALOGUE_START.test(paragraph) ? CHARACTERS : NARRATOR, text: paragraph }))
  );

const SPEAKER_LINE = new RegExp(`^\\s*(${NARRATOR}|${CHARACTERS})\\s*:\\s*(.*)$`, 'i');

/**
 * Reads an AI answer made of "Narrateur: …" / "Personnages: …" lines. Unlabelled lines continue the previous one.
 * @returns {{speaker: string, text: string}[]}
 */
export const parseSpeakerLines = (answer) => {
  const segments = [];
  for (const line of answer.split(/\n+/)) {
    const match = line.match(SPEAKER_LINE);
    if (match) {
      segments.push({ speaker: match[1].toLowerCase() === CHARACTERS.toLowerCase() ? CHARACTERS : NARRATOR, text: match[2] });
    } else if (segments.length > 0) {
      segments[segments.length - 1].text += ` ${line}`;
    }
  }
  return mergeSegments(segments);
};

const compact = (text) => text.replace(/\s+/g, '');

/** True when the segments hold exactly the original words (spacing aside): the AI must not rewrite the story. */
export const checkSplit = (original, segments) =>
  segments.length > 0 && compact(segments.map((segment) => segment.text).join('')) === compact(original);

/** True when a split really has lines for the characters' voice. */
export const hasDialogue = (segments) => segments.some((segment) => segment.speaker === CHARACTERS);

/** Instruction of the AI split (French: the stories are French). */
export const SPLIT_INSTRUCTION = `Tu prépares une histoire pour une lecture à deux voix.
Réponds uniquement par des lignes qui commencent par "${NARRATOR}:" ou "${CHARACTERS}:".
Les paroles prononcées par les personnages (avec leurs tirets ou guillemets) vont à "${CHARACTERS}" ; la narration et les incises (« dit-il », « répondit Léa ») vont à "${NARRATOR}".
Recopie le texte mot pour mot, dans l'ordre : n'ajoute, ne retire et ne reformule rien.`;

/** Sentence read by the voice preview (one line of dialogue for the second voice). */
export const SAMPLE_TEXT = {
  narrator: 'Il était une fois, au bord d\'une forêt tranquille, un petit renard qui rêvait de voir la mer.',
  character: '« Un jour, j\'irai là-bas ! » dit-il en souriant.'
};
