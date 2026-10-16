# Audit : code mort, commentaires périmés, optimisation et sécurité

*Audit du 16 octobre 2026, sur `main` au commit `5444125` (« update generation »). Il fait suite à la refonte de la plupart des pages : génération en masse, séries avec bible, atelier d'illustrations.*

## Sommaire
- [Résumé](#résumé)
- [Méthode](#méthode)
- [Partie 1 : inventaire du code mort et des restes](#partie-1--inventaire-du-code-mort-et-des-restes)
  - [1.1 Serveur : routes, méthodes, exports](#11-serveur--routes-méthodes-exports)
  - [1.2 Client : exports, imports, constantes, CSS](#12-client--exports-imports-constantes-css)
  - [1.3 Dépendances npm](#13-dépendances-npm)
  - [1.4 Traductions (i18n)](#14-traductions-i18n)
  - [1.5 Scripts et fichiers racine](#15-scripts-et-fichiers-racine)
  - [1.6 Commentaires périmés ou faux](#16-commentaires-périmés-ou-faux)
  - [1.7 Documentation et mémoire du projet périmées](#17-documentation-et-mémoire-du-projet-périmées)
  - [1.8 Données que les sauvegardes oublient](#18-données-que-les-sauvegardes-oublient)
  - [1.9 Ce qui est sain](#19-ce-qui-est-sain)
- [Partie 2 : plan d'optimisation et de sécurisation](#partie-2--plan-doptimisation-et-de-sécurisation)
  - [Phase 0 : correctifs critiques](#phase-0--correctifs-critiques-sécurité-et-perte-de-données)
  - [Phase 1 : nettoyage du code mort](#phase-1--nettoyage-du-code-mort-sans-risque)
  - [Phase 2 : durcissement](#phase-2--durcissement)
  - [Phase 3 : performances](#phase-3--performances)
  - [Phase 4 : qualité et outillage](#phase-4--qualité-et-outillage)
- [Annexe : commandes de vérification](#annexe--commandes-de-vérification)

## Résumé

L'application va bien : `typecheck` passe, les **576 tests** passent (126 côté client, 450 côté serveur), `npm audit` ne signale aucune vulnérabilité, aucun fichier source n'est orphelin et le SQL est paramétré partout. Le code mort qui reste est surtout **périphérique** : une route API d'avant la refonte, quelques méthodes, des exports, 46 clés de traduction, du CSS et des scripts de débogage.

L'audit a en revanche trouvé **4 problèmes sérieux**, à traiter avant tout nettoyage :

| # | Gravité | Constat |
|---|---|---|
| S1 | 🔴 Sécurité | L'API n'a **aucune authentification**, `cors()` accepte **toute origine** et le serveur écoute sur **toutes les interfaces**. N'importe quel site ouvert dans le navigateur peut donc appeler `DELETE /api/reset-data` ou lancer des générations payantes. |
| S2 | 🔴 Perte de données | `scripts/init-db.sql` commence par `DROP DATABASE IF EXISTS imagitales`, et `database.js` **l'exécute automatiquement** au démarrage dès que la table `stories` manque. Si `DB_NAME` ne vaut pas `imagitales`, une autre base est supprimée et les tables sont créées au mauvais endroit. |
| S3 | 🔴 Sauvegarde incomplète | Export, sauvegardes automatiques et import **ignorent** `series_casts`, `series_facts` et `series_week_recaps`, c'est-à-dire toute la bible et la mémoire des séries. Restaurer une sauvegarde perd ce travail. De plus, une sauvegarde complète de plus de 50 Mo (avec l'audio) **ne peut pas être réimportée**. |
| S4 | 🟠 Sécurité | L'export PDF lit `image_path` **tel qu'envoyé par le client**, sans le confiner à `uploads/`, ce qui permet une traversée de chemin (`../../`). |

## État d'avancement

| Phase | État | Commit |
|---|---|---|
| 0 : correctifs critiques | ✅ Fait, sauf 0.2 (jeton d'accès, utile seulement si l'API est ouverte au réseau) et 0.6 (restauration des sauvegardes de plus de 50 Mo, avec la phase 4) | `80bb8d2` |
| 1 : nettoyage du code mort | ✅ Fait. Gardés volontairement : migration `story_series` (vieilles bases), `/audio` statique (à vérifier en base), redirection `/theme`, composants shadcn | `0ede1d3` |
| 2 : durcissement | ✅ Fait (2.7 : en-têtes de base ; la CSP viendra avec 4.7, quand Express servira le build) | voir l'historique git |
| 3 : performances | ✅ Fait : 3.4, 3.6, 3.9 (3.1 en phase 1, 3.5 en phase 2). 3.7 passe en phase 4 avec 0.6. 3.2, 3.3 et 3.8 abandonnés, voir la note de la phase 3 | voir l'historique git |
| 4 : qualité et outillage | À faire | |

## Méthode

- **knip 5**, lancé deux fois : avec les tests comme points d'entrée, puis en mode production sans eux, pour repérer les fichiers, exports, types et dépendances inutilisés.
- **Script maison** pour les méthodes de services. Les services sont des instances de classes, que knip ne suit pas : chaque méthode a été recherchée dans tout le code de production.
- **Comparaison des routes** : routes Express d'un côté, appels `client.*` du client et `API_ENDPOINTS` de l'autre.
- **Traductions** : clés de `fr.json` comparées aux littéraux du code, en tenant compte des préfixes dynamiques comme `` t(`ages.${age}`) ``.
- **Variables inutilisées** : `tsc --noUnusedLocals --noUnusedParameters` sur le client, ESLint `no-unused-vars` sur le serveur.
- **Recherche de marqueurs** (`legacy`, `for now`, `TODO`, code commenté, ancien nom « imagitales »), et vérification que chaque chemin cité dans la documentation existe encore.
- **Colonnes de base de données** : chaque colonne des scripts SQL et migrations a été cherchée dans le code.
- **Build de production** (`vite build`) pour mesurer le poids des chunks.

---

## Partie 1 : inventaire du code mort et des restes

### 1.1 Serveur : routes, méthodes, exports

**Routes API que le client n'appelle plus**

| Route | Fichier | Statut |
|---|---|---|
| `POST /api/generate/story` | [generation.routes.js:13](../server/routes/generation.routes.js#L13) → `generateAIStory` ([story.controller.js:97](../server/controllers/story.controller.js#L97)) | **Morte.** C'est la génération synchrone de l'ancien onglet « Générer » de `/create`. La génération passe maintenant par `/api/generation-jobs`. La route reste ouverte et consomme du quota Gemini (voir S1). `storyService.generateFromAI` est toujours utilisé par le worker : seuls la route et le contrôleur sont à retirer. |
| `GET /api/series/casts/:castId` | [series.routes.js:90](../server/routes/series.routes.js#L90) | Le client ne l'appelle pas : il passe par `GET /:id/casts`. À retirer, ou à garder en connaissance de cause. |

Les 86 autres routes sont toutes appelées par le client.

**Méthodes jamais appelées**

| Méthode | Emplacement | Remarque |
|---|---|---|
| `seriesCastService.allCharacterNames()` | [series_cast.service.js:118](../server/services/series_cast.service.js#L118) | Fait doublon avec `generationJobRepository.seriesNames()` ([generation_job.repository.js:193](../server/services/generation_job.repository.js#L193)), qui est la version utilisée par le worker et l'audit. Son commentaire laisse croire que c'est elle qui protège les noms des héros. |
| `seriesCastService.forAgeGroup()` | [series_cast.service.js:99](../server/services/series_cast.service.js#L99) | Jamais appelée. |
| `storySeriesHelper.handleCollisions()` | [story_series.helper.js:45](../server/services/story_series.helper.js#L45) | Simple enveloppe de `resolveSlot`, plus utilisée. |

**Exports jamais importés ailleurs** (encore utilisés dans leur propre fichier : il suffit d'enlever `export`)

| Export | Fichier |
|---|---|
| `PDF_STYLES` | [server/lib/pdf/themes.js:49](../server/lib/pdf/themes.js#L49) |
| `CODE_PATTERN` | [image_prompt.helper.js:10](../server/services/helpers/image_prompt.helper.js#L10) |
| `WEEK_PLAN_LENGTH` | [story_schema.js:92](../server/services/helpers/story_schema.js#L92) |
| `STORY_SORTS` | [story.service.js:109](../server/services/story.service.js#L109) |
| `missingWeekStories` | [generation_plan.helper.js:49](../server/services/helpers/generation_plan.helper.js#L49) (utilisé uniquement par les tests) |
| `extractWeekPlan` | [story_output.helper.js:157](../server/services/helpers/story_output.helper.js#L157) (utilisé uniquement par les tests ; le code utilise `extractWeekContext`) |

**Configuration inutilisée**
- `ENV_CONFIG.PORT` et `ENV_CONFIG.NODE_ENV` ([env.config.js:17](../server/config/env.config.js#L17)) : jamais lus. `server.js` relit `process.env.API_PORT` lui-même.
- La table `story_series` est créée dans [database.js:146](../server/config/database.js#L146) alors que `init-db.sql` la crée déjà. Cette branche ne sert plus qu'aux bases de 2025.
- `app.use('/audio', …)` ([app.js:48](../server/app.js#L48)) sert `public/audio`, l'emplacement de l'audio avant son déplacement vers `uploads/audio`. À retirer après avoir vérifié qu'aucune ligne en base ne référence `/audio/…` (`SELECT COUNT(*) FROM stories WHERE audio_path LIKE '/audio/%'`).
- `upload.single('file')` sur `POST /api/export/pdf` ([pdf.routes.js:18](../server/routes/pdf.routes.js#L18)) : le client envoie du JSON. Ce middleware n'a donc aucune utilité, et il permettrait de déposer une image orpheline dans `uploads/`.
- Les colonnes `ai_requests.duration_ms` et `ai_requests.http_status` sont écrites mais jamais lues. On peut les garder pour le diagnostic ; c'est à noter, rien à corriger.

**Variables locales inutilisées** : aucune côté serveur. La seule alerte, `seriesId` dans [generation_job.service.js:376](../server/services/generation_job.service.js#L376), est une déstructuration volontaire.

### 1.2 Client : exports, imports, constantes, CSS

**Exports et constantes inutilisés**

| Élément | Fichier |
|---|---|
| `stripHtmlTags` | [src/lib/utils.ts:27](../src/lib/utils.ts#L27). Morte, et dangereuse si elle reprend du service : `innerHTML` sur un élément du document exécute les `onerror` des `<img>`. À supprimer. |
| `UploadResponse` (type) | [src/types/system.types.ts](../src/types/system.types.ts) |
| `APP_ROUTES.TIMELINE` | [src/constants.ts:65](../src/constants.ts#L65). Plus largement, `APP_ROUTES` n'est pas utilisé par le routeur : [App.tsx](../src/App.tsx) et [Header.tsx](../src/components/Layout/Header.tsx) écrivent les chemins en dur. |
| `API_ENDPOINTS.SERIES_STORIES_BATCH` | Placeholder `:id` remplacé à la main. Fonctionne, mais incohérent avec les autres endpoints. |
| Route `/theme` → `/themes` | [App.tsx](../src/App.tsx) : redirection d'une ancienne URL. Peut être retirée. |

**Composants UI shadcn non utilisés** : `CommandDialog`, `DialogClose`, `DialogTrigger`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuRadioGroup`, `Form`, `SelectGroup`. Ils sont générés par shadcn : on peut les laisser, ou les retirer pour alléger.

**Imports et variables inutilisés** (`tsc --noUnusedLocals`)
- [PDFExport.tsx:16](../src/components/Common/PDFExport.tsx#L16) : `RadioGroup` et `RadioGroupItem` sont importés mais pas utilisés.
- [useStory.ts](../src/hooks/useStory.ts) lignes 36, 50, 58, 65 et 74 : paramètre `data` des `onSuccess` jamais lu.
- [useStoryData.ts:51-52](../src/hooks/useStoryData.ts#L51) : paramètres `filename` et `fileType` de `addIllustrationToBackend` jamais lus.

**CSS mort** : [src/App.css](../src/App.css) (256 lignes) est importé par la seule `TimelinePage`. Environ 21 sélecteurs sur 28 n'existent plus dans le code. Il s'agit du boilerplate Vite (`.logo`, `@keyframes logo-spin`, `.read-the-docs`) et d'anciennes classes de la timeline (`.timeline-week`, `.timeline-day`, `.age-group-2-3`…, `.story-day`, `.stories-grid`). Le `.card { padding: 2em }` global peut aussi entrer en conflit avec n'importe quel élément de classe `card`.

**Code « legacy » encore nécessaire, à garder mais à documenter**
- `legacyToHtml` ([RichTextEditor.tsx:34](../src/components/Common/RichTextEditor.tsx#L34)) et la branche « Plain Text Logic (Legacy) » de [StoryDetail/StoryContent.tsx:48](../src/components/Story/StoryDetail/StoryContent.tsx#L48) : elles lisent les histoires enregistrées en texte brut. On pourra les retirer après une migration des données (voir la phase 3).
- `legacySheet` (fiche personnages de l'ancienne série, reprise dans la bible) : toujours utilisé.

### 1.3 Dépendances npm

| Paquet | Constat |
|---|---|
| `flag-icons` | **Mort et lourd.** Importé dans [StoriesPage.tsx:13](../src/pages/StoriesPage.tsx#L13), mais aucune classe `fi fi-xx` n'est utilisée. Coût : **142 SVG (3,8 Mo)** et **420 Ko de CSS** dans le build (`StoriesPage-*.css`). |
| `concurrently` | Utilisé uniquement par `npm run dev` : à déplacer dans `devDependencies`. |
| `tailwindcss-animate` | Utilisé via `require` dans `tailwind.config.ts`, chargé par `@config` dans `index.css`. Faux positif de knip, à garder. |

### 1.4 Traductions (i18n)

- `fr.json` et `en.json` ont **1 165 clés** chacun et sont parfaitement alignés.
- **46 clés ne sont plus utilisées**, soit 92 entrées avec les deux langues. Elles viennent surtout des pages refaites :
  - `features.*` (8 clés), `ageGroups.title`, `ageGroups.subtitle` : ancienne page d'accueil.
  - `illustrations.filters.*` (7), `illustrations.filtersTitle`, `illustrations.howTo`, `illustrations.resetFilters` : anciens filtres de l'atelier, remplacés par `StoriesSearch` le 12 octobre.
  - `create.tabs.generate`, `create.storyDetails`, `generation.createTabHint` : ancien onglet « Générer ».
  - `story.edit`, `story.editor`, `story.lastModified`, `story.modified`, `story.restore`, `story.restoreVersion`, `story.selectVersion`, `story.settings`, `story.theme`, `story.weekNumber`, `story.weeklyTheme`, `story.years`.
  - `filters.allAges`, `filters.allWeeks`, `filters.reset`, `common.noDaysAvailable`, `common.search`, `themes.createFirstTheme`, `themes.search`, `themes.sort`, `weeklyThemes.week`, `series.selector.create`, `framed.character.genderPlaceholder`.
- **`obf.json`** (locale « obfusquée » de débogage, visible en mode développeur) : 571 clés, dont **600 manquantes** par rapport à `fr` et **6 orphelines** (`home.badge`, `home.browse`, `home.cta`, `home.subtitle`, `home.welcome`, `story.characterCount`). Elle est à moitié cassée et pèse dans le chunk `i18n` (346 Ko). Deux options : la supprimer, ou la **générer** automatiquement depuis `fr.json`.

### 1.5 Scripts et fichiers racine

| Fichier | Constat |
|---|---|
| `scripts/verify_parsing.js` | **Obsolète.** Il simule l'ancien parseur Markdown (« Titre de l'Histoire : », etc.) avec une copie des expressions régulières. Le format est en JSON depuis la refonte, et `story_output.helper` a ses propres tests. À supprimer. |
| `server/scripts/debug_orphans.js` | Script de débogage ponctuel qui contient encore des notes de conversation (« Wait, the logs might have ID… user didn't give it »). Les clés étrangères en `ON DELETE CASCADE` rendent la vérification inutile. À supprimer. |
| `scripts/models.txt` | Sortie générée par `list_models.js`, versionnée par erreur. À ajouter au `.gitignore`. |
| `scripts/compare_locales.js` | Il ne compare que `fr` et `en`, et ne détecte pas les clés inutilisées. À remplacer par un test Vitest (voir la phase 4). |
| `import-map.json` | Référencé nulle part : Vite utilise `resolve.alias`. À supprimer. |
| `start_servers.bat` | Une ligne parasite `t` (ligne 5), et il ouvre `http://localhost:8080` alors que Vite écoute sur **8885**. Les lignes 33-39 sont des réflexions laissées en commentaire. |
| `server.js` | Dernière ligne `// server restart trigger 2`, vestige pour forcer `node --watch` à redémarrer. |
| `server/config/log-config.json` | Versionné **et** réécrit à l'exécution par `updateLoggerConfig`, ce qui salit le dépôt à chaque changement de réglage. À ajouter au `.gitignore`, comme `app-settings.json`. |
| `.env.example` | Contient `PORT=3000` alors que l'API lit `API_PORT` (3001 par défaut). Il manque `API_PORT`, `AI_PROVIDER`, `GEMINI_MODELS`, `OLLAMA_*` et les délais d'attente (le README les cite pourtant). |
| `.vscode/extensions.json` | Recommande `continue.continue`, une préférence personnelle. |

### 1.6 Commentaires périmés ou faux

| Emplacement | Problème |
|---|---|
| [story.service.js:187](../server/services/story.service.js#L187), [:278](../server/services/story.service.js#L278), [story_output.helper.js:353](../server/services/helpers/story_output.helper.js#L353) | Disent « the client falls back to the text parser », mais `src/utils/storyParser.ts` **n'existe plus**. Une réponse non JSON fait désormais échouer l'unité dans le worker. |
| [StoryIllustrations.tsx:84-90](../src/components/Story/StoryEditor/StoryIllustrations.tsx#L84) | Sept lignes de réflexion laissées en JSX (« OR should I move them too? … I will update imports if I move them later »). |
| [CreateStoryPage.tsx:25](../src/pages/CreateStoryPage.tsx#L25) | « Preview Tab remains from CreateStory for now ». |
| [Header.tsx:30](../src/components/Layout/Header.tsx#L30) | « rudimentary check … kept simple for now ». Il lit `window.location`, donc l'onglet actif **ne se met pas à jour** lors d'une navigation côté client. Remplacer par `NavLink`. |
| [config/logger.js:96-98](../server/config/logger.js#L96) | « We added mkdir in previous step » : **faux**, personne ne crée `server/debug/`. Sur un clone neuf, chaque écriture de log échoue (`ENOENT`) et affiche une erreur dans la console. |
| [env.config.js:10,13](../server/config/env.config.js#L10) | Chemins `d:\appli-coding\lovable\imagitales` d'une ancienne machine. |
| [pdf.routes.js:7-9, 15-17](../server/routes/pdf.routes.js#L7) | Notes de migration (« The existing frontend calls… », « was in original code… keeping it for compatibility »). |
| [src/lib/logger.ts:94-96](../src/lib/logger.ts#L94) | « Fallback: Retain logs if failed? … For now, console error and drop. » |
| [weeklyTheme.routes.js:14](../server/routes/weeklyTheme.routes.js#L14), [weeklyTheme.service.js:98](../server/services/weeklyTheme.service.js#L98), [themes.api.ts:40](../src/api/themes.api.ts#L40) | Marqués « legacy » alors que l'endpoint est **toujours utilisé** par `TopicSuggestionDialog`. Le libellé induit en erreur. |
| [story.service.js:734](../server/services/story.service.js#L734) | Section `// --- Legacy/Small Helpers ---` : vérifier le contenu et renommer la section. |
| [database.js:25](../server/config/database.js#L25) | `multipleStatements: true // Ensure this is enabled for init scripts`, alors que le script d'initialisation est découpé et exécuté instruction par instruction. L'option est inutile et dangereuse (voir la phase 2). |

**Nom du projet** : « imagitales » apparaît encore dans `index.html` (`<title>`), le README, `.env.example`, `init-db.sql`, le nom des sauvegardes et exports (`imagitales-backup-…`), `tailwind.config.ts` et `start_servers.bat`, alors que le dépôt et le paquet s'appellent « romihistoire ». Attention : `BACKUP_NAME_RE` filtre les sauvegardes sur ce préfixe. Un renommage doit **accepter les deux préfixes**, sinon les anciennes sauvegardes disparaissent de la liste.

### 1.7 Documentation et mémoire du projet périmées

Le dépôt n'a ni `CLAUDE.md` ni fichier de mémoire. La « mémoire » du projet tient dans `README.md`, `CONTRIBUTING.md` et [audit-ux-cycle-histoire.md](./audit-ux-cycle-histoire.md).

- **audit-ux-cycle-histoire.md** (7 octobre) cite **10 fichiers qui n'existent plus** : `useStoryGeneration.ts`, `GenerationForm.tsx`, `StoryGenerationTab.tsx`, `RestoreVersionCard.tsx`, `storyParser.ts` et son test, `generationPlan.ts`, `server/lib/pdf/fonts.js`… Son parcours (`/create` avec onglet « Générer ») ne correspond plus à l'application. Il faut ajouter en tête un bandeau « historique, remplacé par la refonte du 9-12 octobre », ou l'archiver dans `docs/archive/`.
- **README.md**
  - Cite `src/utils/storyParser.ts`, qui a été supprimé.
  - Ne décrit pas les fonctions principales actuelles : génération en masse par tâches, grille de couverture, séries avec bible (distribution, faits, récapitulatifs, audit), atelier d'illustrations, statistiques de quota, sauvegardes automatiques.
  - « Theme Management: weekly themes » mélange les thèmes (étiquettes) et les sujets de la semaine.
  - Le tableau des scripts présente `npm run lint`, qui est **cassé** (voir la phase 4).

### 1.8 Données que les sauvegardes oublient

`systemService.exportData` ([system.service.js:228](../server/services/system.service.js#L228)) exporte 10 tables. Les sauvegardes automatiques, l'export ZIP et l'import s'en servent tous. **Trois tables ajoutées par la refonte n'y figurent pas :**

- `series_casts` : la bible, avec la distribution, l'univers et les règles ;
- `series_facts` : la mémoire des faits ;
- `series_week_recaps` : les récapitulatifs hebdomadaires.

`ai_requests` (statistiques de quota) n'y figure pas non plus, ce qui est acceptable.

Autres incohérences :
- `resetData` supprime les séries, et donc les distributions par cascade, mais conserve `weekly_themes`. C'est cohérent si c'est voulu ; il faut le documenter dans l'interface.
- L'import est limité à **50 Mo** ([upload.config.js:83](../server/config/upload.config.js#L83)) et `express.json` à 50 Mo, alors qu'une sauvegarde complète inclut tout `uploads/`, audio compris. **Au-delà de 50 Mo, une sauvegarde ne peut pas être restaurée par l'interface.**

### 1.9 Ce qui est sain

- **Aucun fichier source orphelin** : tous les fichiers sont atteignables depuis `main.tsx`, `server.js` ou les scripts.
- **SQL** : toujours paramétré. Les clauses `SET`, `ORDER BY` et les noms de tables dynamiques viennent de listes blanches (`buildSet`, `STORY_ORDERS`, `SHOW COLUMNS`).
- **XSS** : chaque `dangerouslySetInnerHTML` passe par `DOMPurify.sanitize`.
- **Fichiers servis** : les uploads ont une extension imposée par le type MIME, sont servis avec `nosniff`, et l'import ZIP ne recopie que des médias. Les noms de sauvegardes et de journaux sont validés par expression régulière.
- **Clé Gemini** : elle n'est jamais renvoyée au client (`geminiKeyConfigured: boolean`).
- **Tests et types** : `typecheck` OK, 576 tests OK, `npm audit` sans vulnérabilité.

---

## Partie 2 : plan d'optimisation et de sécurisation

Les priorités suivent le risque. L'effort est estimé ainsi : **XS** < 30 min, **S** < 2 h, **M** ½ à 1 jour, **L** plus d'un jour. Chaque phase peut faire l'objet d'une PR distincte.

### Phase 0 : correctifs critiques (sécurité et perte de données)

| # | Action | Fichiers | Effort |
|---|---|---|---|
| 0.1 | **Fermer l'API aux autres sites (S1).** (a) Écouter sur `127.0.0.1` par défaut, avec une variable `API_HOST` pour l'ouvrir volontairement au réseau local. (b) Remplacer `cors()` par une liste blanche (`http://localhost:8885`, configurable). En développement, le proxy Vite suffit et l'API n'a même pas besoin de CORS. (c) Ajouter un garde-fou anti-CSRF : refuser les requêtes qui modifient des données si leur `Origin` ou `Sec-Fetch-Site` n'est pas same-origin. | `server.js`, `server/app.js` | S |
| 0.2 | **Si l'API est ouverte au réseau :** ajouter un jeton d'accès simple (`API_TOKEN` dans `.env`, en-tête `Authorization`, injecté par le proxy Vite ou saisi dans les réglages). Il est obligatoire avant toute exposition hors de `localhost`. | `server/app.js`, `src/api/client.ts` | M |
| 0.3 | **Désarmer `init-db.sql` (S2).** Retirer `DROP DATABASE`, `CREATE DATABASE` et `USE` du script (garder une variante manuelle séparée, `scripts/reset-db.sql`, pour la réinstallation). Remplacer `CREATE TABLE` par `CREATE TABLE IF NOT EXISTS`. Découper les instructions sans casser sur un `;` de commentaire. | `scripts/init-db.sql`, `server/config/database.js` | S |
| 0.4 | **Ne plus ignorer les échecs de migration.** Aujourd'hui, `database.js:251` écrit `migration_debug.log` et le serveur démarre quand même sur un schéma incomplet. Il faut journaliser et arrêter le démarrage. | `server/config/database.js` | XS |
| 0.5 | **Sauvegardes complètes (S3).** Ajouter `series_casts`, `series_facts` et `series_week_recaps` à `exportData` et `importData`, dans le bon ordre pour les clés étrangères. Ajouter un test qui **échoue dès qu'une table de la base manque à l'export** (comparaison avec `SHOW TABLES` et une liste d'exclusions explicite, par exemple `ai_requests`). | `system.service.js`, `server/tests/services/system.service.test.js` | S |
| 0.6 | **Pouvoir restaurer les grosses sauvegardes.** Monter la limite d'import pour les ZIP (ou la rendre configurable), restaurer directement depuis une sauvegarde du serveur (`POST /api/backups/:filename/restore`, sans transfert), et écrire le ZIP en flux (`archiver` ou `fflate`, déjà installé) au lieu de `zip.toBuffer()`. | `upload.config.js`, `backup.routes.js`, `system.service.js` | M |
| 0.7 | **Corriger la traversée de chemin du PDF (S4).** Le client envoie des **identifiants** d'histoires, et le serveur relit les histoires et illustrations en base. À défaut, `loadImage` résout le chemin et vérifie qu'il reste sous `UPLOADS_DIR` avec une extension d'image. Retirer `upload.single('file')`. | `server/lib/pdf/helpers/loadImage.js`, `pdf.routes.js`, `src/utils/pdfExport.ts` | S |
| 0.8 | **Supprimer `POST /api/generate/story`**, une route morte qui consomme du quota sans contrôle. | `generation.routes.js`, `story.controller.js` | XS |

### Phase 1 : nettoyage du code mort (sans risque)

Une seule PR, qui supprime uniquement du code non référencé et doit garder les tests au vert.

1. **Serveur** : supprimer `allCharacterNames`, `forAgeGroup`, `handleCollisions` et `GET /api/series/casts/:castId` (après décision). Retirer `export` de `PDF_STYLES`, `CODE_PATTERN`, `WEEK_PLAN_LENGTH` et `STORY_SORTS`. Supprimer `extractWeekPlan` et `missingWeekStories` après avoir adapté leurs tests. Supprimer `ENV_CONFIG.PORT` et `NODE_ENV`, ainsi que la migration `story_series` redondante.
2. **Client** : supprimer `stripHtmlTags`, `UploadResponse`, `APP_ROUTES.TIMELINE` (ou faire utiliser `APP_ROUTES` par le routeur), l'import `RadioGroup` de `PDFExport` et les paramètres inutilisés de `useStory`/`useStoryData`. Réduire `App.css` aux seuls sélecteurs de la timeline encore utilisés, ou les passer en classes Tailwind.
3. **Dépendances** : `npm rm flag-icons`, et déplacer `concurrently` dans `devDependencies`.
4. **i18n** : supprimer les 46 clés listées en 1.4 dans `fr.json` et `en.json`, puis supprimer ou régénérer `obf.json`.
5. **Fichiers** : supprimer `scripts/verify_parsing.js`, `server/scripts/debug_orphans.js` et `import-map.json`. Ajouter au `.gitignore` `scripts/models.txt`, `server/config/log-config.json` et `migration_debug.log`. Retirer la dernière ligne de `server.js`.
6. **Commentaires** : corriger ou supprimer chaque entrée du tableau 1.6, en particulier les trois mentions du « text parser » et le bloc JSX de `StoryIllustrations`.
7. **Documentation** : mettre à jour le README (fonctions actuelles, `.env`, scripts) et `.env.example`. Ajouter un bandeau « historique » à `audit-ux-cycle-histoire.md`. Corriger `start_servers.bat` (ligne `t`, port 8885). Optionnel : un `CLAUDE.md` court décrivant l'architecture actuelle, pour éviter que la mémoire se périme à nouveau.

### Phase 2 : durcissement

| # | Action | Détail | Effort |
|---|---|---|---|
| 2.1 | **Désactiver `multipleStatements`** | Avec 0.3, plus rien n'en a besoin. Cela limite l'impact d'une future injection SQL. | XS |
| 2.2 | **Limiter les tailles de corps de requête** | `express.json` est réglé à 50 Mo sur toutes les routes. Passer à environ 1 Mo par défaut et n'augmenter que là où c'est utile (enregistrement d'une histoire avec du HTML). | XS |
| 2.3 | **Valider `POST /api/logs`** | `logger[level?.toLowerCase()]` appelle n'importe quelle méthode de l'objet `logger`. Il faut une liste blanche (`info`, `warn`, `error`), une taille maximale par lot et un débit limité, sinon un client peut remplir le disque. | XS |
| 2.4 | **Limiter le débit** des routes qui coûtent du quota ou des ressources | `generation-jobs` (création, replay), `weekly-themes/suggest`, `stories/:id/audio`, `settings/audio-preview`, `series/casts/:id/audit`, `export/pdf`, `backups` (POST). Un petit limiteur en mémoire suffit (`express-rate-limit`). | S |
| 2.5 | **Clé Gemini dans un en-tête** | Elle passe aujourd'hui en `?key=` dans l'URL ([gemini.service.js:327](../server/services/gemini.service.js#L327)). Utiliser l'en-tête `x-goog-api-key`, pour qu'elle n'apparaisse jamais dans une trace d'erreur ou un journal d'URL. | XS |
| 2.6 | **Messages d'erreur** | `handleError` renvoie `error.message`, et le détail SQL pour les erreurs de base de données. En production, renvoyer un message générique et un identifiant de corrélation, et garder le détail dans le journal. | S |
| 2.7 | **En-têtes de sécurité** | `helmet` (CSP adaptée au build Vite, `X-Frame-Options`, `Referrer-Policy`) quand le build est servi par Express. | S |
| 2.8 | **URL Ollama (SSRF)** | `ollamaBaseUrl` et `test-ollama` acceptent n'importe quelle URL HTTP. Sans danger tant que l'API est locale (0.1). Si elle s'ouvre au réseau, restreindre à `localhost` et au réseau privé, ou à une liste blanche. | XS |
| 2.9 | **Journaux et vie privée** | La requête SQL et ses paramètres (donc le texte complet des histoires) sont écrits **à chaque requête** ([database.js:77](../server/config/database.js#L77)), et `enableSqlLogging` vaut `true` par défaut. Le client envoie aussi chaque clic avec son `innerText` ([App.tsx:90](../src/App.tsx#L90)). Désactiver ces deux journaux par défaut, tronquer les paramètres et limiter le suivi des clics au mode développeur. | S |
| 2.10 | **Import ZIP** | Ajouter un plafond de taille décompressée et de nombre d'entrées (protection contre les bombes zip), et extraire dans `os.tmpdir()` plutôt que dans `process.cwd()`. | S |

### Phase 3 : performances

| # | Action | Gain attendu | Effort |
|---|---|---|---|
| 3.1 | Supprimer `flag-icons` (phase 1) | **−3,8 Mo** de SVG et **−420 Ko** de CSS dans le build. | XS |
| 3.2 | Charger les traductions à la demande | Le chunk `i18n` (346 Ko) embarque `fr`, `en` et `obf`. Importer la langue active avec `import()`. Environ −200 Ko au premier chargement. | S |
| 3.3 | Découper `StoryIllustrations` (555 Ko) | Le canevas de dessin et TipTap sont chargés avec l'éditeur. Les charger en différé (`lazy`) à l'ouverture de l'outil de dessin. | S |
| 3.4 | Journal SQL plus léger | Une ligne JSON par requête SQL, avec ses paramètres, écrite dans un fichier jamais purgé. Cela ralentit chaque requête et fait grossir `logs.jsonl` sans limite. `GET /api/logs` lit **tout le fichier** pour en garder 500 lignes. Désactiver par défaut, faire une rotation journalière et lire la fin du fichier. | S |
| 3.5 | Suivi des clics côté client | Un `POST /api/logs` toutes les 2 s pendant l'utilisation, y compris en production. Le réserver au mode développeur (`import.meta.env.DEV` ou réglage `devMode`). | XS |
| 3.6 | E/S synchrones du serveur | `cleanupImages`, `dirUsage` et `copyImages` utilisent `readdirSync`/`statSync` en récursion, ce qui bloque la boucle d'événements pendant la purge horaire. Passer à `fs.promises`. | S |
| 3.7 | Sauvegardes en flux | Voir 0.6 : `exportData(true)` charge toute la base et **tous les fichiers** en mémoire avant d'écrire. | M |
| 3.8 | Migrer le texte brut vers le HTML | Convertir une fois les histoires encore en texte brut (`content NOT LIKE '<%'`), puis supprimer `legacyToHtml` et la branche « Plain Text Logic ». | S |
| 3.9 | Index de base de données | Vérifier avec `EXPLAIN` les requêtes de couverture (`week_number`, `age_group`, `series_id`, `locale`) et de liste des histoires. Ajouter si besoin un index composite `(locale, series_id, week_number, age_group, day_order)`, qui sert aussi la détection de collision de `resolveSlot`. | S |

### Phase 4 : qualité et outillage

| # | Action | Détail | Effort |
|---|---|---|---|
| 4.1 | **Réparer `npm run lint`** | ESLint 10 est installé **sans configuration** : la commande échoue. Ajouter un `eslint.config.js` (flat config) avec `typescript-eslint`, `react-hooks` et `no-unused-vars`. | S |
| 4.2 | **Garde-fous de code mort en CI** | Ajouter un `knip.json` (point de départ en annexe) et un script `npm run deadcode`. Ajouter aussi un test Vitest qui échoue sur une clé i18n inutilisée ou manquante (en reprenant la logique de cet audit, avec les préfixes dynamiques), pour remplacer `compare_locales.js`. | S |
| 4.3 | **Durcir TypeScript progressivement** | `tsconfig.app.json` a `strict: false` et `noImplicitAny: false`, avec 59 `any` dans le client. Activer `noUnusedLocals` et `noUnusedParameters` tout de suite (8 corrections), puis `strict` dossier par dossier. | M → L |
| 4.4 | **Une seule source pour les tranches d'âge** | `AGE_GROUPS` est défini 3 fois côté serveur (`story.service`, `generation_job.service`, `cast_validation.helper`), 1 fois côté client et 2 fois en `ENUM` SQL. Créer un module `shared/` importé des deux côtés, avec un test de cohérence avec l'`ENUM`. Faire de même pour `themeName.ts` et `theme_name.helper.js` (« keep both in sync »), et pour les types d'image acceptés. | M |
| 4.5 | **Un seul logger serveur** | Deux loggers coexistent : `server/config/logger.js` (catégorie, JSONL dans `server/debug/`) et `server/services/logger.service.js` (journaux `access` et `ai` dans `server/logs/`), avec des signatures différentes. En plus, `requestLogger` écrit son propre `access-*.log`. Les fusionner en un module (niveaux, catégories, rotation, création des dossiers au démarrage), ce qui corrige aussi le `ENOENT` de 1.6. | M |
| 4.6 | **Intégration continue** | Workflow GitHub Actions : `typecheck`, `lint`, `test`, `knip` et `npm audit`, avec un service MySQL pour les tests qui en ont besoin. | S |
| 4.7 | **Servir le build en production** | `npm start` ne sert que l'API : le `dist/` n'est servi par personne. Ajouter `express.static('dist')` avec repli sur `index.html` quand `NODE_ENV=production`, ce qui permet de lancer l'application sans Vite (et d'appliquer 2.7). | S |

> **Note après réalisation.** Les points 3.2 et 3.3 reposaient sur une lecture erronée des noms de chunks : Rollup nomme un chunk partagé d'après son premier module. Le chunk « i18n » (307 Ko) contient surtout react-router et axios ; les traductions ne pèsent que 120 Ko non compressés, et charger seulement la langue active ferait gagner environ 15 Ko compressés en rendant le changement de langue asynchrone. Le chunk « StoryIllustrations » (542 Ko) regroupe zod, TipTap, ProseMirror et react-hook-form, et n'est chargé qu'à l'ouverture des pages de création et d'édition, ce qui est déjà le comportement voulu. Le point 3.8 est abandonné aussi : le texte brut est lu à cinq endroits (lecture, éditeur, aperçu, PDF, résumés) et l'import d'un ancien export en réintroduit. Ces branches doivent donc rester, et une migration du contenu ne permettrait de rien supprimer.
>
> Mesures du point 3.9 sur 26 000 histoires (MariaDB 10.11) : l'index `idx_stories_coverage (locale, series_id, week_number, age_group, day_order)` fait passer la couverture d'une série de 33 à 11 ms, et la détection de collision de 196 à 3 lignes lues. Un second index dédié à la collision était redondant.

### Ordre conseillé

1. **PR 1, phase 0** : 0.1, 0.3, 0.4, 0.5, 0.7 et 0.8. C'est l'essentiel du risque, pour environ une journée de travail.
2. **PR 2, phase 1** : le nettoyage, mécanique et couvert par les tests.
3. **PR 3** : phases 2 et 3, hors sauvegardes en flux.
4. **PR 4, phase 4**, avec 0.6 et 3.7 (sauvegardes en flux, restauration côté serveur).

---

## Annexe : commandes de vérification

```bash
# Code mort (fichiers, exports, dépendances) — mode production, sans les tests
npx knip --production --config knip.json

# Imports / variables inutilisés côté client
npx tsc --noEmit -p tsconfig.app.json --noUnusedLocals --noUnusedParameters

# Taille du build
npx vite build && du -sh dist && ls -S -l dist/assets | head
```

Point de départ pour `knip.json` :

```json
{
  "entry": ["src/main.tsx!", "server.js!", "scripts/*.js!", "server/scripts/*.js!"],
  "project": ["src/**/*.{ts,tsx,js}!", "server/**/*.js!", "server.js!", "scripts/*.js!",
              "!**/*.test.*", "!server/tests/**", "!src/setupTests.ts", "!server/vitest.config.js"],
  "ignoreDependencies": ["tailwindcss-animate"],
  "ignoreExportsUsedInFile": true
}
```
