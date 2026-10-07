import { STORY_DAYS } from './story_schema.js';

export const ALL_WEEK = "Toute la semaine";

const KNOWN_AGES = ["2-3", "4-6", "7-9", "10-12", "13-15", "16-18"];
const DEFAULT_AGE = "4-6";

/**
 * Writing profile per age group. Lengths stay within the output budget of a full week (7 stories).
 */
const AGE_PROFILES = {
  "2-3": {
    wordCount: "environ 150-250 mots",
    paragraphs: "4 à 6 paragraphes très courts",
    storyStyle: "Phrases de 5 à 8 mots, mots concrets du quotidien, répétitions et onomatopées (« plouf », « miam »). Un seul personnage principal, une seule action à la fois, ton doux et rassurant.",
    illustrationStyle: "Style « Livre d'éveil » : formes rondes et simples, couleurs vives et franches, gros plan sur un personnage mignon, fond épuré, aucun détail effrayant."
  },
  "4-6": {
    wordCount: "environ 300-450 mots",
    paragraphs: "5 à 8 paragraphes courts",
    storyStyle: "Phrases simples mais variées, vocabulaire concret avec un ou deux mots nouveaux expliqués par le contexte. Dialogues courts, ton enjoué, une petite difficulté résolue grâce à la curiosité ou l'entraide.",
    illustrationStyle: "Style album jeunesse : aquarelle ou gouache douce, personnages expressifs, scène lisible au premier coup d'œil, couleurs chaleureuses."
  },
  "7-9": {
    wordCount: "environ 500-700 mots",
    paragraphs: "6 à 9 paragraphes",
    storyStyle: "Phrases plus longues et liées, vocabulaire riche mais accessible, dialogues vivants. Une vraie intrigue avec un problème à résoudre ; la notion scientifique sert à le résoudre.",
    illustrationStyle: "Style roman illustré : décor détaillé, textures et lumière travaillées, mouvement dans la scène, palette harmonieuse."
  },
  "10-12": {
    wordCount: "environ 700-900 mots",
    paragraphs: "7 à 10 paragraphes",
    storyStyle: "Narration plus ambitieuse : descriptions, émotions nuancées, humour, personnages qui doutent et raisonnent. La science est expliquée avec précision (causes, conséquences, ordres de grandeur).",
    illustrationStyle: "Style roman illustré pour grands lecteurs : composition dynamique, éclairage cinématographique, détails réalistes avec une touche d'imaginaire."
  },
  "13-15": {
    wordCount: "environ 900-1100 mots",
    paragraphs: "8 à 12 paragraphes",
    storyStyle: "Ton « Young Adult » : narration immersive, dialogues naturels, enjeux personnels et questionnements éthiques autour de la science. Vocabulaire scientifique exact, défini quand il apparaît.",
    illustrationStyle: "Style « Young Adult » : illustration semi-réaliste, ambiance travaillée (lumière, météo, profondeur de champ), personnages adolescents crédibles."
  },
  "16-18": {
    wordCount: "environ 1000-1200 mots",
    paragraphs: "9 à 13 paragraphes",
    storyStyle: "Écriture littéraire pour jeunes adultes, sans édulcorer : réflexion, nuances, démarche scientifique (hypothèse, observation, preuve). Le lecteur est traité en adulte.",
    illustrationStyle: "Style « Young Adult » mature : illustration réaliste ou concept art, composition soignée, ambiance réfléchie, détails scientifiques exacts."
  }
};

const DAY_RULES = {
  Lundi: "Lundi : ouvrir la semaine. Présenter les personnages et le thème, puis terminer par un cliffhanger (suspense ou question) qui donne envie de lire la suite demain.",
  Mardi: "Mardi : approfondir le thème avec une nouvelle découverte, puis terminer par un cliffhanger.",
  Mercredi: "Mercredi : rebondissement au milieu de la semaine, puis terminer par un cliffhanger.",
  Jeudi: "Jeudi : la difficulté atteint son sommet, puis terminer par un cliffhanger.",
  Vendredi: "Vendredi : résoudre l'intrigue de la semaine, puis suggérer subtilement une activité pour le week-end, en lien direct avec le thème (ex. « Et si ce week-end, nous allions observer les papillons dans le jardin ? »).",
  Samedi: "Samedi : histoire douce qui prolonge le thème, avec une idée d'activité pratique à faire en famille. Pas de cliffhanger.",
  Dimanche: "Dimanche : conclure la semaine. Récapituler ce que les personnages ont appris, avec une fin apaisée. Pas de cliffhanger."
};

/** Number of characters kept from a raw previous chapter (text fallback when no summary exists). */
const PREVIOUS_CHAPTER_TAIL = 1500;
/** Existing themes listed in the prompt (most used first): enough to reuse, short enough for small models. */
export const MAX_EXISTING_THEMES = 80;

/**
 * Builds the prompts for story generation (Gemini, Gemma and Ollama).
 * The model must answer with JSON matching story_schema.js.
 */
export class PromptHelper {

  /**
   * Stable system instruction: role, child-safety and writing rules, output contract.
   * @returns {string}
   */
  static buildSystemInstruction() {
    return [
      "Tu es un auteur jeunesse francophone, spécialiste de la vulgarisation scientifique et de la nature.",
      "Tu écris des histoires éducatives pour une plateforme qui publie une histoire par jour, autour d'un thème par semaine.",
      "",
      "Règles de contenu :",
      "- Contenu adapté aux enfants : pas de violence, pas de peur excessive, pas de marques ni de personnes réelles.",
      "- Personnages bienveillants ; les conflits se résolvent par la curiosité, l'entraide et la réflexion.",
      "- Faits scientifiques exacts. En cas de doute, reste simple plutôt que faux.",
      "",
      "Règles d'écriture :",
      "- Montre plutôt qu'expliquer : la notion scientifique se découvre à travers l'action et les dialogues.",
      "- Une notion scientifique principale par histoire.",
      "- Pas de morale lourde ni de leçon finale récitée.",
      "- Écris en français, avec une orthographe et une typographie soignées (guillemets « », espaces avant ; : ! ?).",
      "",
      "Format : réponds UNIQUEMENT avec un objet JSON valide qui respecte le format demandé. Aucun texte avant ni après, pas de bloc de code markdown, pas de markdown dans les valeurs."
    ].join("\n");
  }

  /**
   * Builds the user prompt.
   * @param {Object} params - Generation parameters
   * @param {string} params.theme - Weekly theme
   * @param {string} params.age - Age group ("4-6" or "4-6 ans")
   * @param {string} [params.day] - Day of week (French) or "Toute la semaine"
   * @param {number} [params.numCharacters] - Number of main characters
   * @param {string} [params.charNames] - Names of characters
   * @param {string} [params.seriesName] - Series name
   * @param {string} [params.previousSummary] - Summary of the previous story (preferred)
   * @param {string} [params.previousChapter] - Previous story content (fallback when no summary)
   * @param {string[]} [params.existingThemes] - Names of the themes already in the library (most used first)
   * @returns {string} The constructed prompt
   */
  static buildStoryPrompt({ theme, age, day, numCharacters, charNames, seriesName, previousSummary, previousChapter, existingThemes }) {
    const isWeek = day === ALL_WEEK;
    const ageKey = this.normalizeAge(age);
    const profile = this.getAgeProfile(ageKey);
    const targetDay = isWeek ? null : this.normalizeDay(day);

    const mission = isWeek
      ? `Générez une SÉRIE COMPLÈTE de 7 histoires, une par jour, du Lundi à Dimanche, qui forment une seule aventure suivie. Le tableau "stories" contient exactement 7 éléments, dans l'ordre des jours.`
      : `Générez UNE SEULE histoire, pour le ${targetDay || "jour demandé"}. Le tableau "stories" contient exactement 1 élément.`;

    const parameters = [
      `- Thème hebdomadaire : « ${theme} ». Reliez-le à la saison ou à un événement du calendrier si c'est pertinent.`,
      `- Tranche d'âge : ${ageKey} ans.`,
      this.getCharacterPrompt(numCharacters, charNames),
      this.getSeriesContext(seriesName)
    ].filter(Boolean).join("\n");

    const audience = [
      `- Longueur : ${profile.wordCount} par histoire, en ${profile.paragraphs}.`,
      `- Style : ${profile.storyStyle}`,
      `- Titre : court, captivant et unique${isWeek ? " (7 titres différents)" : ""}.`
    ].join("\n");

    const dayRules = isWeek
      ? STORY_DAYS.map(d => `- ${DAY_RULES[d]}`).join("\n")
      : `- ${DAY_RULES[targetDay] || "Histoire complète avec un début, un milieu et une fin."}`;

    const illustration = [
      `- Pour chaque histoire, une seule description d'illustration (champ "illustration_prompt"), très détaillée : scène, personnages (apparence, vêtements, expressions), action, décor, lumière, couleurs, cadrage.`,
      `- ${profile.illustrationStyle}`,
      `- Continuité visuelle : les personnages récurrents sont décrits avec les mêmes traits d'un jour à l'autre.`,
      `- Aucun texte écrit dans l'image.`
    ].join("\n");

    return [
      "## MISSION",
      mission,
      "",
      "## PARAMÈTRES",
      parameters,
      "",
      "## PUBLIC",
      audience,
      "",
      "## CONTINUITÉ",
      this.getContinuityPrompt({ isWeek, previousSummary, previousChapter }),
      "",
      "## SPÉCIFICITÉS DU JOUR",
      dayRules,
      "",
      "## ILLUSTRATION",
      illustration,
      "",
      "## THÈMES ASSOCIÉS",
      this.getThemesPrompt(theme, existingThemes),
      "",
      "## FORMAT DE SORTIE",
      this.getOutputFormat(isWeek ? "Lundi" : (targetDay || "Lundi"))
    ].join("\n");
  }

  /** "4-6 ans" / "4-6" / unknown -> "4-6". */
  static normalizeAge(age) {
    const normalized = String(age || "").replace(/\s*ans\s*$/i, "").trim();
    return KNOWN_AGES.includes(normalized) ? normalized : DEFAULT_AGE;
  }

  /** "lundi", "Lundi.", "**Mercredi**" -> "Lundi" / "Mercredi"; unknown -> null. */
  static normalizeDay(day) {
    const cleaned = String(day || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z]/g, "").toLowerCase();
    return STORY_DAYS.find(d => d.toLowerCase() === cleaned) || null;
  }

  /**
   * Writing profile of an age group.
   * @param {string} age - "4-6" or "4-6 ans" (unknown values fall back to 4-6).
   * @returns {{wordCount: string, paragraphs: string, storyStyle: string, illustrationStyle: string}}
   */
  static getAgeProfile(age) {
    return { ...AGE_PROFILES[this.normalizeAge(age)] };
  }

  /** @deprecated Use getAgeProfile. Kept for older callers. */
  static getStyleByAge(age) {
    return this.getAgeProfile(age);
  }

  static getCharacterPrompt(numCharacters, charNames) {
    const lines = [];
    if (numCharacters && numCharacters > 0) {
      lines.push(`- Nombre de personnages principaux : ${numCharacters}.`);
    }
    if (charNames && String(charNames).trim()) {
      lines.push(`- Noms des personnages principaux : ${String(charNames).trim()}.`);
    }
    return lines.join("\n");
  }

  static getSeriesContext(seriesName) {
    if (seriesName && String(seriesName).trim()) {
      return `- Série : « ${String(seriesName).trim()} ». Restez fidèle à l'univers et aux personnages de cette série.`;
    }
    return "";
  }

  /**
   * Asks the model to reuse the library's themes, so generation does not create near-duplicates.
   * @param {string} weeklyTheme - Theme of the week (always one of the story's themes).
   * @param {string[]} [existingThemes] - Existing theme names, most used first.
   */
  static getThemesPrompt(weeklyTheme, existingThemes = []) {
    const names = [...new Set((existingThemes || []).map(name => String(name).trim()).filter(Boolean))].slice(0, MAX_EXISTING_THEMES);
    const lines = [`- Le premier thème de chaque histoire est le thème de la semaine : « ${weeklyTheme} ».`];
    if (names.length > 0) {
      lines.push(
        "- THÈMES EXISTANTS : pour les autres thèmes, réutilisez exactement l'un de ces noms (même orthographe) :",
        `  ${names.map(name => `« ${name} »`).join(", ")}.`,
        "- Ne proposez un nouveau thème que si aucun thème existant ne convient ; donnez-lui alors un nom court et général (ex. « Nature », « Amitié »)."
      );
    } else {
      lines.push("- Les autres thèmes ont des noms courts et généraux (ex. « Nature », « Amitié »).");
    }
    return lines.join("\n");
  }

  static getContinuityPrompt({ isWeek, previousSummary, previousChapter }) {
    const summary = previousSummary && String(previousSummary).trim();
    const chapter = !summary && previousChapter && String(previousChapter).trim();

    if (summary || chapter) {
      const context = summary
        ? summary
        : `… ${chapter.slice(-PREVIOUS_CHAPTER_TAIL)}`;
      return [
        "RÉSUMÉ PRÉCÉDENT (histoire de la veille) :",
        `"""${context}"""`,
        "CONTINUITÉ : Enchaînez logiquement sur ce résumé, avec les mêmes personnages, et faites avancer l'intrigue. Ne racontez pas à nouveau l'histoire de la veille ; le titre doit être différent."
      ].join("\n");
    }

    return isWeek
      ? "Les 7 histoires suivent les mêmes personnages et forment une progression : chaque jour s'appuie sur le précédent."
      : "Cette histoire est une aventure autonome : elle doit se comprendre sans avoir lu les autres jours.";
  }

  static getOutputFormat(exampleDay) {
    return [
      "Un objet JSON avec une seule clé \"stories\" : un tableau d'histoires. Chaque histoire a exactement ces champs :",
      `- "day" : jour de la semaine, parmi ${STORY_DAYS.map(d => `"${d}"`).join(", ")}.`,
      "- \"title\" : le titre, sans guillemets ni markdown.",
      "- \"summary\" : résumé de l'histoire en 2 ou 3 phrases (il servira de contexte pour l'histoire suivante).",
      "- \"themes\" : 1 ou 2 thèmes associés, chacun avec \"name\" (ex. \"Nature\"), \"description\" (une phrase), \"icon\" (un emoji) et \"color\" (code hexadécimal, ex. \"#4CAF50\").",
      "- \"paragraphs\" : le texte de l'histoire, un paragraphe par élément, sans titre ni description d'illustration.",
      "- \"illustration_prompt\" : la description détaillée de l'illustration.",
      "",
      "Exemple de structure (contenu à remplacer) :",
      JSON.stringify({
        stories: [{
          day: exampleDay,
          title: "Le secret de la goutte d'eau",
          summary: "Léa découvre d'où vient la pluie…",
          themes: [{ name: "Nature", description: "Le cycle de l'eau", icon: "💧", color: "#2196F3" }],
          paragraphs: ["Premier paragraphe…", "Deuxième paragraphe…"],
          illustration_prompt: "Une petite fille aux tresses rousses, en ciré jaune…"
        }]
      })
    ].join("\n");
  }
}
