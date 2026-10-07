import { describe, it, expect } from 'vitest';
import { PromptHelper } from '../../services/helpers/prompt.helper.js';

describe('PromptHelper', () => {

    describe('getAgeProfile', () => {
        it('should describe a "Livre d\'éveil" for 2-3 years', () => {
            const profile = PromptHelper.getAgeProfile('2-3 ans');
            expect(profile.wordCount).toContain('150-250 mots');
            expect(profile.illustrationStyle).toContain("Livre d'éveil");
        });

        it('should ask for simple but varied sentences for 4-6 years', () => {
            const profile = PromptHelper.getAgeProfile('4-6');
            expect(profile.wordCount).toContain('300-450 mots');
            expect(profile.storyStyle).toContain('Phrases simples mais variées');
        });

        it('should target "Young Adult" readers for 13-15 years', () => {
            const profile = PromptHelper.getAgeProfile('13-15');
            expect(profile.wordCount).toContain('900-1100 mots');
            expect(profile.illustrationStyle).toContain('Young Adult');
        });

        it('should keep getStyleByAge as an alias', () => {
            expect(PromptHelper.getStyleByAge('7-9')).toEqual(PromptHelper.getAgeProfile('7-9'));
        });
    });

    describe('buildSystemInstruction', () => {
        it('should require JSON only, in French, with child-safe content', () => {
            const system = PromptHelper.buildSystemInstruction();
            expect(system).toContain('UNIQUEMENT avec un objet JSON');
            expect(system).toContain('français');
            expect(system).toContain('pas de violence');
        });
    });

    describe('buildStoryPrompt', () => {
        const baseParams = { theme: 'Espace', age: '7-9', day: 'Lundi' };

        it('should ask for a single autonomous story by default', () => {
            const prompt = PromptHelper.buildStoryPrompt(baseParams);
            expect(prompt).toContain('Générez UNE SEULE histoire');
            expect(prompt).not.toContain('SÉRIE COMPLÈTE');
            expect(prompt).toContain('500-700 mots');
            expect(prompt).toContain('aventure autonome');
            expect(prompt).toContain('« Espace »');
        });

        it('should ask for a full week when day is "Toute la semaine"', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Toute la semaine' });
            expect(prompt).toContain('Générez une SÉRIE COMPLÈTE');
            expect(prompt).toContain('Lundi à Dimanche');
            expect(prompt).toContain('exactement 7 éléments');
            // Every day rule is listed
            ['Lundi :', 'Vendredi :', 'Dimanche :'].forEach(rule => expect(prompt).toContain(rule));
        });

        it('should include the previous summary and a continuity instruction', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Mardi', previousSummary: 'Léa a trouvé une étoile.' });
            expect(prompt).toContain('RÉSUMÉ PRÉCÉDENT');
            expect(prompt).toContain('Léa a trouvé une étoile.');
            expect(prompt).toContain('CONTINUITÉ : Enchaînez logiquement');
            expect(prompt).not.toContain('aventure autonome');
        });

        it('should keep the END of a raw previous chapter when no summary exists', () => {
            const chapter = `${'début '.repeat(400)}FIN DU CHAPITRE`;
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Mardi', previousChapter: chapter });
            expect(prompt).toContain('FIN DU CHAPITRE');
            expect(prompt).toContain('RÉSUMÉ PRÉCÉDENT');
        });

        it('should include the Friday weekend activity', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Vendredi' });
            expect(prompt).toContain('SPÉCIFICITÉS DU JOUR');
            expect(prompt).toContain('Vendredi');
            expect(prompt).toContain('suggérer subtilement une activité');
            expect(prompt).not.toContain('Lundi : ouvrir la semaine');
        });

        it('should accept day names in any case', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'vendredi' });
            expect(prompt).toContain('pour le Vendredi');
        });

        it('should add characters and series only when provided', () => {
            const without = PromptHelper.buildStoryPrompt(baseParams);
            expect(without).not.toContain('personnages principaux :');
            expect(without).not.toContain('Série :');

            const withAll = PromptHelper.buildStoryPrompt({ ...baseParams, numCharacters: 2, charNames: 'Léo, Mia', seriesName: 'Les Explorateurs' });
            expect(withAll).toContain('Nombre de personnages principaux : 2');
            expect(withAll).toContain('Léo, Mia');
            expect(withAll).toContain('« Les Explorateurs »');
        });

        it('should list existing themes to reuse, weekly theme first', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, existingThemes: ['Nature', 'Amitié', 'Nature', ''] });
            expect(prompt).toContain('## THÈMES ASSOCIÉS');
            expect(prompt).toContain('thème de la semaine : « Espace »');
            expect(prompt).toContain('THÈMES EXISTANTS');
            expect(prompt).toContain('« Nature », « Amitié ».');
        });

        it('should cap the existing themes list', () => {
            const many = Array.from({ length: 120 }, (_, i) => `Thème ${i}`);
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, existingThemes: many });
            expect(prompt).toContain('« Thème 79 »');
            expect(prompt).not.toContain('« Thème 80 »');
        });

        it('should ask for short general names when the library is empty', () => {
            const prompt = PromptHelper.buildStoryPrompt(baseParams);
            expect(prompt).not.toContain('THÈMES EXISTANTS');
            expect(prompt).toContain('noms courts et généraux');
        });

        it('should describe the JSON output format', () => {
            const prompt = PromptHelper.buildStoryPrompt(baseParams);
            expect(prompt).toContain('FORMAT DE SORTIE');
            ['"stories"', '"day"', '"title"', '"summary"', '"themes"', '"paragraphs"', '"illustration_prompt"']
                .forEach(field => expect(prompt).toContain(field));
        });
    });
});
