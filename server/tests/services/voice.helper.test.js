// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildTtsRequestBody, checkSplit, hasDialogue, parseSpeakerLines, resolveAudioOptions, splitDialogueHeuristic, validateAudioOptions,
  CHARACTERS, NARRATOR
} from '../../services/helpers/voice.helper.js';

describe('voice.helper', () => {
  describe('resolveAudioOptions', () => {
    it('should follow the age group in auto style', () => {
      expect(resolveAudioOptions({}, {}, '2-3')).toMatchObject({ voice: 'Sulafat', style: 'calm', pace: 'slow', multiSpeaker: false });
      expect(resolveAudioOptions({}, {}, '10-12 ans')).toMatchObject({ style: 'storyteller', pace: 'normal' });
      expect(resolveAudioOptions({}, {}, '16-18')).toMatchObject({ style: 'neutral', pace: 'normal' });
    });

    it('should prefer the request, then the settings, then the defaults', () => {
      const saved = { voice: 'Kore', characterVoice: null, style: 'dramatic', pace: 'lively', multiSpeaker: true };

      const fromSettings = resolveAudioOptions({}, saved, '2-3');
      expect(fromSettings).toMatchObject({ voice: 'Kore', characterVoice: 'Puck', style: 'dramatic', pace: 'lively', multiSpeaker: true });

      // 'auto' asked for this story wins over the saved pace
      const fromRequest = resolveAudioOptions({ voice: 'Leda', style: 'auto', pace: 'auto', multiSpeaker: false }, saved, '2-3');
      expect(fromRequest).toMatchObject({ voice: 'Leda', style: 'calm', pace: 'slow', multiSpeaker: false });
      expect(fromRequest.styleText).toContain('slowly');
    });
  });

  describe('validateAudioOptions', () => {
    it('should keep known values and report the others', () => {
      const { options, errors } = validateAudioOptions({ voice: 'Puck', style: 'shouting', pace: null, multiSpeaker: 'yes', extra: 1 });

      expect(options).toEqual({ voice: 'Puck' });
      expect(errors).toHaveLength(2);
    });
  });

  describe('buildTtsRequestBody', () => {
    const resolved = resolveAudioOptions({ voice: 'Achernar', characterVoice: 'Fenrir' }, {}, '4-6');

    it.each(['gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview'])('should put the style before the text for %s', (model) => {
      const body = buildTtsRequestBody(model, 'Il était une fois', resolved);
      const part = body.contents[0].parts[0];

      expect(body.generationConfig.speechConfig).toEqual({ voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Achernar' } } });
      expect(part.speechMetadata).toBeUndefined();
      expect(part.text).toContain(resolved.styleText);
      expect(part.text.endsWith('Il était une fois')).toBe(true);
    });

    it('should give the style apart to Gemini 3+ models', () => {
      const part = buildTtsRequestBody('gemini-3.8-flash-tts', 'Il était une fois', resolved).contents[0].parts[0];

      expect(part).toEqual({ text: 'Il était une fois', speechMetadata: { style: resolved.styleText } });
    });

    const segments = [{ speaker: NARRATOR, text: 'Le renard sourit.' }, { speaker: CHARACTERS, text: '« Bonjour ! »' }];

    it('should write a labelled transcript for two voices on older models', () => {
      const text = buildTtsRequestBody('gemini-2.5-flash-preview-tts', segments, resolved).contents[0].parts[0].text;

      expect(text.endsWith(`${NARRATOR}: Le renard sourit.\n${CHARACTERS}: « Bonjour ! »`)).toBe(true);
    });

    it('should configure two voices with one part per line on Gemini 3.8+', () => {
      const body = buildTtsRequestBody('gemini-3.8-flash-tts', segments, resolved);

      expect(body.contents[0].parts).toEqual([
        { text: 'Le renard sourit.', speechMetadata: { speaker: NARRATOR, style: resolved.styleText } },
        { text: '« Bonjour ! »', speechMetadata: { speaker: CHARACTERS, style: resolved.styleText } }
      ]);
      expect(body.generationConfig.speechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs).toEqual([
        { speaker: NARRATOR, voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Achernar' } } },
        { speaker: CHARACTERS, voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } }
      ]);
    });
  });

  describe('two-voice split', () => {
    const story = 'Le renard arriva.\n— Bonjour ! dit-il.\n« Qui est là ? »\nLa chouette se tut.\nPuis elle sourit.';

    it('should give dialogue paragraphs to the characters', () => {
      expect(splitDialogueHeuristic(story)).toEqual([
        { speaker: NARRATOR, text: 'Le renard arriva.' },
        { speaker: CHARACTERS, text: '— Bonjour ! dit-il. « Qui est là ? »' },
        { speaker: NARRATOR, text: 'La chouette se tut. Puis elle sourit.' }
      ]);
      expect(hasDialogue(splitDialogueHeuristic('Une histoire sans dialogue.'))).toBe(false);
    });

    it('should read labelled lines and accept them only when no word changed', () => {
      const answer = `${NARRATOR}: Le renard arriva.\n${CHARACTERS}: — Bonjour !\n${NARRATOR}: dit-il.\n${CHARACTERS}: « Qui est là ? »\n${NARRATOR}: La chouette se tut.\nPuis elle sourit.`;
      const segments = parseSpeakerLines(answer);

      expect(segments).toHaveLength(5);
      expect(segments[4]).toEqual({ speaker: NARRATOR, text: 'La chouette se tut. Puis elle sourit.' });
      expect(checkSplit(story, segments)).toBe(true);

      const rewritten = parseSpeakerLines(answer.replace('arriva', 'est arrivé'));
      expect(checkSplit(story, rewritten)).toBe(false);
      expect(checkSplit(story, [])).toBe(false);
    });
  });
});
