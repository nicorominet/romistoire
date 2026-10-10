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
            expect(week).toContain('au moins 7 paragraphes (7 à 9 paragraphes de 3 à 4 phrases), soit au moins 300 mots (environ 300-450 mots), et jamais plus de 450 mots pour chacune des 7 histoires');
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

            const prompt = PromptHelper.buildStoryPrompt({ ...baseParams, weekNumber: 30 });
            expect(prompt).toMatch(/- Période : .*juillet, en été/);
            // The week number is not given as such: models wrote "la semaine quarante-deux" in the story
            expect(prompt).not.toMatch(/semaine 30/);
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

    // Fixes from the content audit of October 2026
    describe('audit rules', () => {
        const baseParams = { theme: 'Halloween', age: '10-12', day: 'Lundi' };

        it('should not suggest example names and should keep the instructions out of the story', () => {
            const system = PromptHelper.buildSystemInstruction();
            // "(Zoé, Léo)" made every week of the 7-18 years have the same two heroes
            expect(system).not.toMatch(/Zoé|Léo\b/);
            expect(system).toContain('Prénoms : français et variés');
            expect(system).toContain('guillemets français, ouverts et fermés');
            expect(system).toContain('ne parle jamais de la consigne');
            expect(system).toContain('Un seul temps de récit');
            expect(PromptHelper.buildStoryPrompt({ ...baseParams, day: 'Toute la semaine', age: '4-6' })).not.toContain('Léa');
        });

        it('should reserve the names of the other series heroes', () => {
            const outside = PromptHelper.buildStoryPrompt({ ...baseParams, reservedNames: ['Antonin', 'Léonie'] });
            expect(outside).toContain('Prénoms réservés aux héros d\'autres séries, à ne pas utiliser : « Antonin », « Léonie ».');

            const inSeries = PromptHelper.buildStoryPrompt({ ...baseParams, seriesName: 'Léonie', reservedNames: ['Antonin', 'Léonie'] });
            expect(inSeries).toContain('à ne pas utiliser : « Antonin ».');
            expect(PromptHelper.buildStoryPrompt(baseParams)).not.toContain('Prénoms réservés');
        });

        it('should give the fixed character sheet of the series', () => {
            const context = PromptHelper.getSeriesContext('Antonin', 'Antonin : garçon de 3 ans, cheveux bruns, vit avec sa maman.');
            expect(context).toContain('Série : « Antonin »');
            expect(context).toContain('Fiche de la série, à respecter à l\'identique (prénoms, âge, apparence, famille, liens entre personnages) : Antonin : garçon de 3 ans');
            expect(PromptHelper.getSeriesContext('Antonin')).not.toContain('Fiche');
            expect(PromptHelper.getSeriesContext('')).toBe('');
        });

        it('should ask a whole week in one answer for its character sheets, with the ties between characters', () => {
            const params = { ...baseParams, age: '4-6', day: 'Toute la semaine' };
            expect(PromptHelper.wantsCharacters(params)).toBe(true);
            expect(PromptHelper.wantsWeekPlan(params)).toBe(false);
            expect(PromptHelper.wantsCharacters({ ...baseParams, day: 'Mardi', weekSeries: true, previousDays: [{ day: 'Lundi', title: 'A', summary: 'S' }] })).toBe(false);

            const prompt = PromptHelper.buildStoryPrompt(params);
            expect(prompt).toContain('Un objet JSON avec deux clés : "characters"');
            expect(prompt).toContain('lien avec les autres personnages');
            expect(prompt).toContain('Établissez d\'abord la fiche des personnages');
            expect(prompt).toContain('Les 7 histoires sont toutes différentes');
        });

        it('should give a maximum length as firm as the minimum', () => {
            expect(PromptHelper.getLengthRule('2-3')).toContain('au moins 150 mots (environ 150-250 mots), et jamais plus de 250 mots');
        });

        it('should place the program weeks in the coming months', () => {
            const october10 = new Date(Date.UTC(2026, 9, 10)); // ISO week 41
            expect(PromptHelper.yearOfWeek(1, october10)).toBe(2027);
            expect(PromptHelper.yearOfWeek(40, october10)).toBe(2026);
            expect(PromptHelper.yearOfWeek(53, october10)).toBe(2026);
        });

        it('should give the autumn holidays without Halloween before its date', () => {
            const week43 = PromptHelper.getCalendarRule(43, 2026);
            expect(week43).toContain('la semaine va du lundi 19 octobre au dimanche 25 octobre 2026');
            expect(week43).toContain('vacances scolaires de la Toussaint toute la semaine (l\'école reprend le lundi 2 novembre)');
            expect(week43).not.toContain('Halloween le');
            expect(week43).toContain('Une fête ne se célèbre que le jour où elle tombe');

            const week44 = PromptHelper.getCalendarRule(44, 2026);
            expect(week44).toContain('Halloween le samedi 31 octobre');
            expect(week44).toContain('la Toussaint le dimanche 1er novembre');
        });

        it('should place Christmas, the holidays and the New Year on their real days', () => {
            const week51 = PromptHelper.getCalendarRule(51, 2026);
            expect(week51).not.toContain('Noël le');
            expect(week51).toContain('vacances scolaires de Noël du samedi 19 décembre au dimanche 3 janvier (l\'école reprend le lundi 4 janvier)');

            const week52 = PromptHelper.getCalendarRule(52, 2026);
            expect(week52).toContain('le réveillon de Noël le jeudi 24 décembre ; Noël le vendredi 25 décembre');
            expect(week52).toContain('vacances scolaires de Noël toute la semaine');

            const week53 = PromptHelper.getCalendarRule(53, 2026);
            expect(week53).toContain('du lundi 28 décembre au dimanche 3 janvier 2027');
            expect(week53).toContain('la Saint-Sylvestre le jeudi 31 décembre ; le Nouvel An le vendredi 1er janvier');
        });

        it('should compute Easter and leave a plain school week without events', () => {
            // Easter 2027: Sunday March 28 (week 12), Easter Monday in the next week
            expect(PromptHelper.getCalendarRule(12, 2027)).toContain('Cette semaine : Pâques le dimanche 28 mars.');
            expect(PromptHelper.getCalendarRule(13, 2027)).toContain('le lundi de Pâques le lundi 29 mars');
            const plain = PromptHelper.getCalendarRule(47, 2026);
            expect(plain).toContain('la semaine va du lundi 16 novembre au dimanche 22 novembre 2026');
            expect(plain).not.toContain('Cette semaine');
            expect(PromptHelper.getCalendarRule(0, 2026)).toBe('');
        });

        it('should put the calendar in the story prompt', () => {
            expect(PromptHelper.buildStoryPrompt({ ...baseParams, weekNumber: 43 })).toContain('- Calendrier : la semaine va du lundi');
        });
    });
});
