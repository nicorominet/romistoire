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

        it('should give the topic of the week as a writing parameter, not as a tag', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, themeDescription: 'Les planètes du système solaire' });
            expect(prompt).toContain('Sujet de la semaine : « Espace »');
            expect(prompt).toContain('Précisions sur le sujet : Les planètes du système solaire');
            const tags = prompt.slice(prompt.indexOf('## ÉTIQUETTES'), prompt.indexOf('## FORMAT DE SORTIE'));
            expect(tags).not.toContain('Espace');
            expect(PromptHelper.buildStoryPrompt(baseParams)).not.toContain('Précisions sur le sujet');
        });

        it('should open a 7-day series on the first day of a week generated day by day', () => {
            const series = PromptHelper.buildStoryPrompt({ ...baseParams, weekSeries: true });
            expect(series).toContain('ouvre une aventure suivie sur 7 jours');
            expect(series).not.toContain('aventure autonome');

            expect(PromptHelper.buildStoryPrompt(baseParams)).toContain('aventure autonome');
            // Next days continue the summary of the previous one
            const next = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Mardi', weekSeries: true, previousSummary: 'Hier, Léo a trouvé une carte.' });
            expect(next).toContain('Hier, Léo a trouvé une carte.');
            expect(next).not.toContain('ouvre une aventure');
        });

        it('should ask the first day of a week for the plan of the week', () => {
            const monday = PromptHelper.buildStoryPrompt({ ...baseParams, weekSeries: true });
            expect(PromptHelper.wantsWeekPlan({ ...baseParams, weekSeries: true })).toBe(true);
            expect(monday).toContain('"week_plan"');
            expect(monday).toContain('"characters"');
            expect(monday).toContain('trois clés');
            expect(monday).toContain('ne dévoilez pas les découvertes des jours suivants');

            expect(PromptHelper.wantsWeekPlan(baseParams)).toBe(false);
            expect(PromptHelper.wantsWeekPlan({ ...baseParams, day: 'Mardi', weekSeries: true })).toBe(false);
            expect(PromptHelper.buildStoryPrompt(baseParams)).not.toContain('week_plan');
        });

        it('should give a later day the plan, the days told and the last scene to pick up', () => {
            const plan = ['Léo trouve une carte', 'La carte mène au lac', 'Le pont est cassé', 'Ils construisent un radeau', 'Ils trouvent le trésor', 'Atelier radeau', 'Bilan'];
            const prompt = PromptHelper.buildStoryPrompt({
                ...baseParams, day: 'Mercredi', weekSeries: true, weekPlan: plan,
                previousDays: [
                    { day: 'Lundi', title: 'La carte', summary: 'Léo trouve une carte.' },
                    { day: 'Mardi', title: 'Le lac', summary: 'La carte mène au lac ; le pont est cassé.' }
                ],
                previousEnding: 'Léo pose le pied sur la première planche. Elle craque !'
            });

            expect(prompt).toContain('PLAN DE LA SEMAINE');
            expect(prompt).toContain("Aujourd'hui (Mercredi) : Le pont est cassé");
            expect(prompt).toContain('DÉJÀ RACONTÉ');
            expect(prompt).toContain('- Mardi « Le lac » : La carte mène au lac');
            expect(prompt).toContain('à ne pas recopier');
            expect(prompt).toContain('"""Léo pose le pied sur la première planche. Elle craque !"""');
            expect(prompt).toContain('se passe un nouveau jour');
            expect(prompt).toContain('en nommant le personnage principal');
            expect(prompt).toContain('répondez au suspense laissé hier');
            expect(prompt).toContain('Ne recopiez aucune phrase');
            expect(prompt).not.toContain('mot pour mot');
            expect(prompt).not.toContain('reprend exactement');
            expect(prompt).toContain('Le titre doit être différent de : « La carte », « Le lac ».');
            expect(prompt).not.toContain('"week_plan"');
        });

        it('should give a whole week in one answer the same continuity rules as day by day', () => {
            const week = PromptHelper.buildStoryPrompt({ ...baseParams, age: '4-6', day: 'Toute la semaine' });
            const continuity = week.slice(week.indexOf('## CONTINUITÉ'), week.indexOf('## SPÉCIFICITÉS DU JOUR'));

            expect(continuity).toContain('une seule aventure suivie');
            expect(continuity).toContain('rappelle en une phrase où en était l\'aventure la veille, en nommant le personnage principal');
            expect(continuity).toContain('Les 7 débuts sont tous différents');
            expect(continuity).toContain('Le vendredi résout tous les mystères');
            expect(week).toContain('au moins 7 paragraphes (7 à 9 paragraphes de 3 à 4 phrases), soit au moins 300 mots (environ 300-450 mots) pour chacune des 7 histoires');
            // Length comes from developed scenes, never from filler paragraphs
            expect(week).toContain('jamais en ajoutant des paragraphes de remplissage');
        });

        it('should forbid opening with the reminder of the previous day, in both modes', () => {
            const week = PromptHelper.buildStoryPrompt({ ...baseParams, age: '4-6', day: 'Toute la semaine' });
            const day = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Mardi', weekSeries: true, previousDays: [{ day: 'Lundi', title: 'A', summary: 'S' }] });

            for (const prompt of [week, day]) {
                expect(prompt).toContain('Ne commencez jamais par « Hier », « La veille », « Après avoir », « Alors que »');
                expect(prompt).toContain('le rappel de la veille vient en deuxième ou troisième phrase');
            }
            expect(PromptHelper.buildSystemInstruction()).toContain('Les dialogues sont toujours entre guillemets français');
        });

        it('should show the openings already used and ask for a new one', () => {
            const prompt = PromptHelper.buildStoryPrompt({
                ...baseParams, day: 'Mercredi', weekSeries: true,
                previousDays: [
                    { day: 'Lundi', title: 'A', summary: 'S', opening: 'La nuit de décembre enveloppait la maison.' },
                    { day: 'Mardi', title: 'B', summary: 'S', opening: 'Alors que la bise glaçait les carreaux, Claudine ajusta ses lunettes.' }
                ]
            });

            expect(prompt).toContain('DÉBUTS DÉJÀ UTILISÉS (ne pas imiter)');
            expect(prompt).toContain('- « Alors que la bise glaçait les carreaux, Claudine ajusta ses lunettes. »');
            expect(prompt).toContain('Ouvrez sur une scène nouvelle');
            expect(prompt).toContain('gestes ou tics descriptifs');
            expect(PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Mardi', weekSeries: true, previousDays: [{ day: 'Lundi', title: 'A', summary: 'S' }] }))
                .not.toContain('DÉBUTS DÉJÀ UTILISÉS');
        });

        it('should give the character sheets to later days, for the text and the illustration', () => {
            const characters = [{ name: 'Papouin', description: 'Garçon de 5 ans, cheveux blonds en bataille, short bleu, tee-shirt rayé rouge.' }];
            const prompt = PromptHelper.buildStoryPrompt({
                ...baseParams, day: 'Mardi', weekSeries: true, characters,
                previousDays: [{ day: 'Lundi', title: 'La plage', summary: 'Papouin découvre le sable.' }]
            });

            expect(prompt).toContain('PERSONNAGES (mêmes noms, même apparence, même caractère)');
            expect(prompt).toContain('- Papouin : Garçon de 5 ans, cheveux blonds en bataille');
            expect(prompt).toContain('exactement comme dans la fiche PERSONNAGES');
        });

        it('should ask for a minimum length', () => {
            expect(PromptHelper.buildStoryPrompt(baseParams)).toContain('au moins 500 mots');
        });

        it('should tie the suspense to the plan and close every mystery on Friday', () => {
            const plan = ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept'];
            const context = { previousDays: [{ day: 'Lundi', title: 'T', summary: 'S' }], previousEnding: 'Fin.' };
            const wednesday = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Mercredi', weekSeries: true, weekPlan: plan, ...context });
            expect(wednesday).toContain('Demain (Jeudi) : Quatre');
            expect(wednesday).toContain("N'introduisez pas de nouveau mystère, objet ou personnage hors du plan");

            const friday = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Vendredi', weekSeries: true, weekPlan: plan, ...context });
            expect(friday).toContain('Résolvez tous les mystères');
            expect(friday).not.toContain('Demain (Samedi)');

            const sunday = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Dimanche', weekSeries: true, weekPlan: plan, ...context });
            expect(sunday).toContain('ne rouvrez aucun mystère');

            expect(PromptHelper.buildStoryPrompt({ ...baseParams, weekSeries: true })).toContain('annonce la deuxième étape de votre plan');
        });

        it('should give the period of the week', () => {
            expect(PromptHelper.getWeekPeriod(30, 2026)).toBe('fin juillet, en été');
            expect(PromptHelper.getWeekPeriod(1, 2026)).toBe('début janvier, en hiver');
            expect(PromptHelper.getWeekPeriod(10, 2026)).toBe('début mars, au printemps');
            expect(PromptHelper.getWeekPeriod(99)).toBeNull();

            expect(PromptHelper.buildStoryPrompt({ ...baseParams, weekNumber: 30 })).toMatch(/- Période : semaine 30, .*en été/);
            expect(PromptHelper.buildStoryPrompt(baseParams)).not.toContain('- Période');
        });

        it('should add the length hint of a second try, and forbid anglicisms', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, lengthHint: 'Votre précédente version faisait 200 mots.' });
            expect(prompt).toContain('- IMPORTANT : Votre précédente version faisait 200 mots.');
            expect(PromptHelper.buildSystemInstruction()).toContain('aucun anglicisme');
        });

        it('should keep the summary of the previous day for callers without week context', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Mardi', previousSummary: 'Hier, Léo a trouvé une carte.' });
            expect(prompt).toContain('RÉSUMÉ PRÉCÉDENT');
            expect(prompt).not.toContain('PLAN DE LA SEMAINE');
        });

        it('should give the target length as numbers', () => {
            expect(PromptHelper.getTargetWords('13-15')).toEqual({ min: 900, max: 1100 });
            expect(PromptHelper.getTargetWords('2-3 ans')).toEqual({ min: 150, max: 250 });
        });

        it('should list the titles already used in the series', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, avoidTitles: ['Le festin des oiseaux', 'Le festin des oiseaux', ''] });
            expect(prompt).toContain('Titres déjà utilisés dans cette série, à ne pas reprendre ni imiter de près : « Le festin des oiseaux ».');
            expect(PromptHelper.buildStoryPrompt(baseParams)).not.toContain('Titres déjà utilisés');
        });

        it('should list existing tags to reuse, without the vague ones', () => {
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, existingThemes: ['Nature', 'Amitié', 'Champignons', 'Nature', 'curiosite', ''] });
            expect(prompt).toContain('## ÉTIQUETTES');
            expect(prompt).toContain('ÉTIQUETTES EXISTANTES');
            expect(prompt).toContain('« Amitié », « Champignons ».');
        });

        it('should cap the existing themes list', () => {
            const many = Array.from({ length: 120 }, (_, i) => `Thème ${i}`);
            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, existingThemes: many });
            expect(prompt).toContain('« Thème 79 »');
            expect(prompt).not.toContain('« Thème 80 »');
        });

        it('should ask for 2 or 3 tags: the precise subject first, then values, never vague ones', () => {
            const prompt = PromptHelper.buildStoryPrompt(baseParams);
            const tags = prompt.slice(prompt.indexOf('## ÉTIQUETTES'), prompt.indexOf('## FORMAT DE SORTIE'));
            expect(prompt).not.toContain('ÉTIQUETTES EXISTANTES');
            expect(tags).toContain('2 ou 3 étiquettes');
            expect(tags).toContain("d'abord sa notion ou son univers précis");
            expect(tags).toContain('Pas d\'étiquette vague');
            // The former examples anchored every story on them
            expect(tags).not.toContain('ex. « Nature »');
            expect(tags).not.toContain('noms courts et généraux');
            // A week varies its values from day to day
            expect(PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Toute la semaine' })).toContain('les valeurs changent');
            expect(tags).not.toContain('les valeurs changent');
        });

        it('should describe the JSON output format', () => {
            const prompt = PromptHelper.buildStoryPrompt(baseParams);
            expect(prompt).toContain('FORMAT DE SORTIE');
            ['"stories"', '"day"', '"title"', '"summary"', '"themes"', '"paragraphs"', '"illustration_prompt"']
                .forEach(field => expect(prompt).toContain(field));
        });
    });
});
