# Audit UI/UX : cycle de vie d'une histoire

*Audit du 7 octobre 2026 : relecture du code de la création (manuelle et IA), de la consultation, de l'édition, des illustrations, de l'audio, des versions et de la suppression.*

## Sommaire
- [Méthode et périmètre](#méthode-et-périmètre)
- [Constats](#1-création--onglet--générer--ia)
- [Correctifs P0 réalisés](#correctifs-p0-réalisés)
- [Backlog restant (P1 / P2)](#backlog-restant-p1--p2)
- [Vérification](#vérification)
- [Audit 2 : génération automatique et images](#audit-2--génération-automatique-et-gestion-des-images)

## Méthode et périmètre
L'audit suit le parcours d'une histoire de bout en bout, à travers le code :

`/create` (onglets Générer / Écrire / Illustrer / Aperçu) → `POST /api/stories` → `/stories` (bibliothèque) → `/stories/:id` (lecture, audio, navigation, suppression) → `/edit/:id` (contenu, réglages, illustrations, versions) → `PUT /api/stories/:id` / restauration.

Fichiers principaux : `src/pages/{Create,Edit}StoryPage.tsx`, `src/pages/Story{Detail,ies}Page.tsx`, `src/hooks/useStoryGeneration.ts`, `src/components/Story/**`, `server/services/story.service.js`, `story_version.service.js`, `story_series.helper.js`.

Documentation du projet vérifiée aussi : README.md et CONTRIBUTING.md (écarts en §8). Il n'existe ni CLAUDE.md ni mémoire de projet.

Gravité : 🔴 bug / perte de données · 🟠 parcours cassé ou trompeur · 🟡 incohérence / finition

---

## 1. Création — onglet « Générer » (IA)
- 🔴 **Le bouton « Générer » soumet aussi le formulaire manuel.** *(✅ corrigé, voir P0-1)* `GenerationForm` est rendu à l'intérieur du `<form>` de [CreateStoryPage.tsx:207](../src/pages/CreateStoryPage.tsx#L207), et son `<Button>` n'a pas de `type="button"` ([GenerationForm.tsx:182](../src/components/Story/CreateStory/GenerationForm.tsx#L182)). Chaque clic lance aussi la validation zod du formulaire manuel, qui affiche des erreurs (« Title is required »…) sur l'onglet Écrire. Même chose avec Entrée dans les champs « nb personnages » / « noms ».
- 🔴 **Changer d'onglet pendant la génération casse le suivi.** *(✅ corrigé, voir P0-1)* Radix `TabsContent` démonte l'onglet inactif : on perd le journal et l'état `isGenerating`, alors que la boucle continue en arrière-plan, sauvegarde quand même et finit par rediriger (`navigate`) 2 s après. Rien ne bloque les onglets, le bouton Enregistrer ou la navigation pendant la génération.
- 🟠 **Barre de progression calculée mais jamais affichée** : `progress` est renvoyé par `useStoryGeneration` mais `StoryGenerationTab` ne le lit pas. Le compteur ne tient pas compte des semaines ignorées (`weekNotFound` fait `continue` sans incrémenter le compteur) et n'atteint donc jamais 100 %.
- 🟠 **Faux « succès »** : si aucune semaine sélectionnée n'a de thème hebdo, ou si toutes les itérations Ollama échouent (erreurs avalées dans le `try` interne, [useStoryGeneration.ts:180](../src/hooks/useStoryGeneration.ts#L180)), on affiche quand même « succès », un toast et la redirection.
- 🟠 **Gestion d'erreur incohérente** : en mode semaine + Ollama, les erreurs sont avalées jour par jour. En mode Gemini, une seule erreur arrête tout le lot, alors que des histoires ont déjà été sauvegardées. L'utilisateur ne sait pas lesquelles ont été créées.
- 🟠 **Redirection vers `/stories`** ([CreateStoryPage.tsx:152](../src/pages/CreateStoryPage.tsx#L152)) au lieu de l'histoire générée ou d'une liste filtrée sur ce qui vient d'être créé.
- 🟠 **Langue forcée à `"fr"`** pour toute histoire générée ([useStoryGeneration.ts:93](../src/hooks/useStoryGeneration.ts#L93)), même si l'interface est en anglais. Aucun choix de langue n'est proposé.
- 🟠 **Tranches d'âge 13-15 / 16-18 proposées** à la génération, mais refusées à l'édition (voir §4).
- 🟡 Libellé « Toute la semaine » codé en dur en français, et valeurs des jours en français (`Lundi`…) côté génération alors que le manuel utilise `Monday`… : deux référentiels de jours.
- 🟡 Sélecteurs `<select multiple>` natifs avec « maintenir Ctrl » : peu découvrable, inutilisable sur mobile, et le style ne correspond pas aux Select shadcn du reste du formulaire.
- 🟡 La colonne de droite (« Détails de l'histoire » + bouton Enregistrer) reste affichée sur l'onglet Générer, où elle n'a aucun effet. Le sélecteur de série est présent en double (dans l'onglet et dans la colonne), avec deux valeurs indépendantes.
- 🟡 Les thèmes inconnus renvoyés par l'IA sont créés automatiquement en base sans prévenir ([useStoryGeneration.ts:49](../src/hooks/useStoryGeneration.ts#L49)), ce qui pollue la liste des thèmes.
- 🟡 La clé i18n `create.generate.logs.noThemesError` n'existe ni en FR ni en EN.

## 2. Création — onglets Écrire / Illustrer / Aperçu
- 🟠 **Onglet par défaut = « Écrire »** alors que « Générer » est placé en premier dans la barre d'onglets : l'ordre visuel ne correspond pas à l'onglet sélectionné.
- 🟠 **Aucune protection contre la perte du travail** : quitter la page (lien du header, retour arrière) efface le texte et les illustrations sans demander confirmation.
- 🟠 **Images orphelines** : en création, l'image est envoyée tout de suite au serveur ([CreateStoryPage.tsx:128](../src/pages/CreateStoryPage.tsx#L128)). La retirer ou abandonner la page laisse le fichier sur le disque (seul le nettoyage manuel dans Paramètres le supprime).
- 🟠 **Créneau occupé → série « Alias » créée en silence** : si une histoire existe déjà pour (semaine, jour, âge, langue), `handleCollisions` crée sans prévenir une série « X (Alias 1) » et y range l'histoire ([story_series.helper.js:56](../server/services/story_series.helper.js#L56)). L'utilisateur ne retrouve pas sa série. De plus, une histoire *sans série* déclenche une collision avec une histoire *de la série choisie* (`series_id = ? OR series_id IS NULL`).
- 🟡 Champ « Langue » en saisie libre (`Input`), alors que les filtres et le regroupement de la liste attendent `fr` / `en` : la moindre faute de frappe crée un groupe fantôme.
- 🟡 « Jour » et « Semaine » ne sont pas obligatoires : un jour vide devient silencieusement lundi / semaine 1.
- 🟡 Code mort : l'état `weeklyTheme` n'est jamais renseigné, le titre « (Thème hebdo : …) » ne s'affiche donc jamais en création. Le panneau affiche « Version 1 / Créé le / Modifié le » avec des dates fictives.

## 3. Consultation — page détail
- 🔴 **Contenu HTML injecté sans assainissement** *(✅ corrigé, voir P0-5)* (`dangerouslySetInnerHTML`, [StoryDetail/StoryContent.tsx:42](../src/components/Story/StoryDetail/StoryContent.tsx#L42)) : un contenu venant de l'IA ou d'un import JSON est exécuté tel quel (risque XSS).
- 🟠 **« Retour » et « Supprimer » ramènent à l'accueil `/`** au lieu de la bibliothèque `/stories` ([StoryDetailPage.tsx:60,124](../src/pages/StoryDetailPage.tsx#L124)). L'utilisateur perd son contexte et ses filtres.
- 🟠 **Navigation précédent / suivant limitée** à la même semaine, tranche d'âge et série, **sans filtre sur la langue** ([story.service.js:348](../server/services/story.service.js#L348)) : on peut passer d'une histoire FR à une histoire EN, et on ne passe jamais du dimanche au lundi suivant.
- 🟠 **Audio** : textes codés en dur en français (« Générer Audio », toasts…). Le `<source type="audio/mpeg">` pointe vers un fichier `.wav`. Le fichier porte la version dans son nom (`id_vN.wav`), l'URL peut donc rester en cache si la version ne change pas.
- 🟡 `storyApi.generateAudio` renvoie `response.data`, alors que le client axios renvoie déjà `data` : le résultat vaut toujours `undefined`.

## 4. Édition
- 🔴 **Formulaire bloqué pour les 13-15 / 16-18 ans** *(✅ corrigé, voir P0-2)* : le schéma zod n'accepte que 4 tranches d'âge ([formSchema.ts:7](../src/components/Story/StoryEditor/formSchema.ts#L7)), alors que `AGE_GROUPS` en définit 6. Une histoire de ces tranches ne peut plus être enregistrée (erreur zod en anglais).
- 🔴 **Le changement de série est ignoré** *(✅ corrigé, voir P0-3)* : l'`UPDATE` serveur ne touche pas `series_id` ([story.service.js:271](../server/services/story.service.js#L271)). Le message de succès s'affiche, mais la série n'a pas changé.
- 🟠 **Aucune détection de collision à l'édition** (contrairement à la création) *(✅ corrigé, voir P0-3)* : déplacer une histoire vers un créneau déjà occupé crée un doublon.
- 🟠 **Deux logiques d'enregistrement sur une même page** : les illustrations sont ajoutées ou supprimées **immédiatement** côté serveur, alors que le texte et les réglages n'existent qu'après « Enregistrer ». Annuler (Retour) ne revient donc pas sur les images. La suppression d'image ne demande pas de confirmation et ne crée pas de version.
- 🟠 **L'audio est effacé à chaque enregistrement** (`audio_path = NULL`), même pour un simple changement de jour, sans prévenir, et l'ancien fichier `.wav` reste sur le disque.
- 🟠 **Audio après édition** : l'éditeur riche enregistre du HTML, mais la génération audio ne retire que `[Illustration:…]` et `**` ([story.service.js:56](../server/services/story.service.js#L56)). Les balises `<p>`… arrivent donc dans le texte envoyé au TTS. Les prompts d'illustration en format `> **Illustration` ou HTML sont lus à voix haute.
- 🟡 Pas d'avertissement si on quitte avec des modifications non enregistrées. Spinner `.spinner` différent du skeleton de la page détail. Message d'erreur en anglais (« Unable to load story »). La version envoyée par le client (`story.version + 1`) est ignorée par le serveur (code trompeur). Le premier thème sélectionné devient « principal » sans aucune indication à l'écran.

- 🔴 **Plusieurs boutons de l'éditeur soumettent le formulaire** *(découvert en corrigeant P0-1, ✅ corrigé)*. Le composant `Button` (shadcn) n'impose pas de type, donc tout bouton placé dans le `<form>` d'édition ou de création est un bouton *submit*. Conséquences : ouvrir le sélecteur de série, cliquer « Restaurer » (restauration **et** enregistrement concurrents), supprimer une illustration, cliquer « Upload » ou les boutons image de l'éditeur riche **enregistraient l'histoire** à l'insu de l'utilisateur.

## 5. Versions / restauration
- 🔴 **Restaurer une version efface l'état courant** *(✅ corrigé, voir P0-4)* : aucun snapshot n'est pris avant la restauration ([story_version.service.js:24](../server/services/story_version.service.js#L24)). Si la version courante n'a jamais été sauvegardée dans l'historique (c'est le cas de la dernière édition), elle est perdue définitivement.
- 🟠 La restauration ne rétablit que le titre, le contenu, l'âge et les thèmes, pas la semaine, le jour, la langue ni la série. Le numéro de version **recule** *(✅ corrigé, voir P0-4)* (`version = versionData.version`), ce qui rend l'historique confus.
- 🟡 La restauration ne demande pas de confirmation et n'offre aucun aperçu ni diff avant de restaurer.

## 6. Suppression
- 🟠 Suppression définitive sans annulation possible. Les fichiers images et audio restent sur le disque. Le message de confirmation est générique (`common.deleteConfirmDesc`) et ne nomme pas l'histoire.
- 🟡 La suppression n'est possible que depuis la page détail : rien depuis la liste, pas de suppression en lot.

## 7. Bibliothèque / liste
- 🟠 **Filtres non persistés** : synchronisation URL → état dans un seul sens. Changer un filtre ne met pas l'URL à jour, donc retour arrière, partage ou rechargement font perdre les filtres.
- 🟠 Thèmes dont le nom contient une virgule : ils sont mal découpés (`GROUP_CONCAT` + `split(',')`, [story.service.js:381](../server/services/story.service.js#L381)), ce qui produit des badges faux dans la liste.
- 🟡 La réinitialisation met le thème à `'all'` alors que la valeur initiale est `''` (deux états pour « aucun filtre »). Le chemin d'image est construit différemment dans la carte (`/${image_path}`, sans normaliser les `\` Windows) et dans l'aperçu (`getImageSrc`). L'export PDF ne porte que sur les histoires **déjà chargées** par le défilement infini.

## 8. Transversal & documentation (fichiers « mémoire »)
- 🟡 i18n incomplète malgré « Fully localized » dans le README : chaînes FR codées en dur (audio, « Toute la semaine », fallbacks `|| "Modèle Ollama"`), toasts EN codés en dur dans `useStoryData`, messages zod en anglais.
- 🟡 Deux systèmes de toast mélangés : `sonner` (création, édition) et `useToast` shadcn (détail, liste).
- 🟡 Mode sombre géré de trois façons : écouteur `darkModeChanged` dupliqué dans Create et Edit, hook `useDarkMode` ailleurs, classes Tailwind `dark:`.
- 🟡 README : nom « Romistoire » alors que le dépôt et la base s'appellent « imagitales ». La fonction « AI Illustration Prompts » n'a pas d'UI dédiée (les prompts sont seulement intégrés au texte). Le tableau des scripts est mal formé (`|Col |---|`). Le README ne parle pas de la gestion des séries / alias ni du versionnement.
- 🟡 CONTRIBUTING impose « typage strict, pas de `any` » et « magic strings dans constants.ts », mais le parcours d'histoire utilise massivement `any`, des jours en dur et des routes en dur (`/stories/${id}`).
- ℹ️ Mémoire Claude du projet vide, pas de CLAUDE.md : rien d'obsolète à corriger. Ces constats pourront être enregistrés plus tard si tu le souhaites.

---

## Correctifs P0 réalisés

### P0-1 : soumissions involontaires du formulaire, et génération interrompue par un changement d'onglet
**Avant** : le bouton « Générer », le sélecteur de série, « Restaurer », la suppression et l'upload d'illustration, ainsi que les boutons image de l'éditeur riche, étaient des boutons *submit* placés dans le `<form>`. Les cliquer lançait la validation, ou enregistrait l'histoire. Changer d'onglet pendant une génération démontait le composant (journal perdu, boucle poursuivie en arrière-plan).

**Après** :
- `type="button"` sur tous ces boutons :
  - [GenerationForm.tsx](../src/components/Story/CreateStory/GenerationForm.tsx), [SeriesSelector.tsx](../src/components/Story/SeriesSelector.tsx)
  - [RestoreVersionCard.tsx](../src/components/Story/EditStory/RestoreVersionCard.tsx), [IllustrationList.tsx](../src/components/Story/EditStory/IllustrationList.tsx), [IllustrationUpload.tsx](../src/components/Story/EditStory/IllustrationUpload.tsx)
  - [RichTextEditor.tsx](../src/components/Common/RichTextEditor.tsx), [SimpleDrawingCanvas.tsx](../src/components/Editor/SimpleDrawingCanvas.tsx)
- La touche Entrée dans les champs du formulaire de génération ne soumet plus le formulaire manuel.
- [CreateStoryPage.tsx](../src/pages/CreateStoryPage.tsx) : l'onglet Générer reste monté (`forceMount` + `data-[state=inactive]:hidden`). [StoryGenerationTab.tsx](../src/components/Story/CreateStory/StoryGenerationTab.tsx) remonte `isGenerating` via `onGeneratingChange`, ce qui désactive les autres onglets et le bouton Enregistrer pendant la génération.

### P0-2 : tranches d'âge 13-15 / 16-18 refusées
**Avant** : `z.enum(["2-3","4-6","7-9","10-12"])` alors que `AGE_GROUPS` en définit 6. Les histoires de ces tranches (générées par l'IA) ne pouvaient plus être enregistrées.

**Après** : [formSchema.ts](../src/components/Story/StoryEditor/formSchema.ts) utilise `z.enum(AGE_GROUPS)`, et le cast restreint de [EditStoryPage.tsx](../src/pages/EditStoryPage.tsx) a été retiré.

### P0-3 : série ignorée à l'édition, et collisions non gérées
**Avant** : `storyService.update` ne mettait jamais `series_id` à jour. Aucun contrôle de créneau.

**Après** ([story.service.js](../server/services/story.service.js), [story_series.helper.js](../server/services/story_series.helper.js)) :
- si le payload contient un champ série, il est résolu via `resolveSeriesId` (série créée si besoin ; nom vide = sortie de la série). Sinon, la série actuelle est conservée.
- si le créneau change (semaine, jour, âge, langue ou série), `handleCollisions` est appelé avec `excludeStoryId`, pour qu'une histoire ne soit jamais en collision avec elle-même. Le comportement « Alias » est le même qu'à la création.
- semaine, âge et langue absents du payload reprennent désormais la valeur existante (avant : écrasés par `undefined`).

### P0-4 : la restauration perdait l'état courant
**Avant** : `restoreVersion` écrasait la ligne sans snapshot préalable et remettait l'ancien numéro de version (l'historique reculait).

**Après** ([story_version.service.js](../server/services/story_version.service.js)) : snapshot de l'état courant (avec ses thèmes) dans la transaction, avant d'écraser. Le contenu restauré reçoit `getNextVersionNumber()` : l'historique avance toujours, et l'état d'avant la restauration reste restaurable.

### P0-5 : HTML non assaini (XSS)
**Avant** : `dangerouslySetInnerHTML` sur le contenu brut (page détail, aperçu) et sur la description de suppression de série (qui contient le nom de la série).

**Après** : dépendance `dompurify` ajoutée ; `DOMPurify.sanitize()` dans [StoryDetail/StoryContent.tsx](../src/components/Story/StoryDetail/StoryContent.tsx), [StoryPreviewTab.tsx](../src/components/Story/CreateStory/StoryPreviewTab.tsx) et [SeriesManagementPage.tsx](../src/pages/SeriesManagementPage.tsx).

### Tests ajoutés / adaptés
- `server/tests/services/story.service.test.js` : 5 tests `update` (série enregistrée, série retirée, série conservée sans champ, collision qui exclut l'histoire elle-même, branche Alias si le créneau est pris).
- `server/tests/services/story_version.service.test.js` : snapshot pris avant l'UPDATE, version qui avance (mocks adaptés au nouveau flux).
- `src/components/Story/StoryEditor/formSchema.test.ts` : les 6 tranches d'âge sont acceptées, une tranche inconnue est refusée.

---

## Backlog restant (P1 / P2)
**P1 — parcours**
1. Génération : afficher `progress`, compter les succès et les échecs réels, ne rediriger que s'il y a au moins une histoire créée, avec un récapitulatif cliquable. Même gestion d'erreur entre Gemini et Ollama.
2. Choix de la langue à la génération (défaut = langue de l'interface) au lieu de `"fr"` en dur.
3. Page détail : « Retour » et « après suppression » → `/stories` (ou `navigate(-1)`) ; filtres de la bibliothèque synchronisés dans l'URL.
4. Prévenir l'utilisateur quand une série « Alias » est créée (toast avec le nom de la série) ; revoir la règle `OR series_id IS NULL`.
5. Garde « modifications non enregistrées » en création et en édition.
6. Audio : retirer les balises HTML avant le TTS, type MIME `audio/wav`, avertir qu'un enregistrement efface l'audio, supprimer les anciens fichiers.
7. Navigation précédent / suivant : filtrer par `locale`, enchaîner sur la semaine suivante.
8. Édition : choisir entre illustrations enregistrées immédiatement et enregistrées au clic sur « Enregistrer » (aujourd'hui les deux coexistent) ; confirmation avant de supprimer une image ou de restaurer une version.

**P2 — cohérence**
9. i18n des chaînes en dur (audio, « Toute la semaine », toasts de `useStoryData`, messages zod), clé `create.generate.logs.noThemesError` manquante.
10. Un seul système de toast (sonner *ou* shadcn) ; un seul mécanisme de mode sombre.
11. Select shadcn multi-choix à la place des `<select multiple>` ; champ Langue en Select fr/en ; jour et semaine obligatoires.
12. Découpage des thèmes (`GROUP_CONCAT` + virgule) : utiliser un séparateur sûr ou `JSON_ARRAYAGG`.
13. README : nom du projet (Romistoire / imagitales), tableau des scripts cassé, documenter séries/alias et versionnement.

## Vérification
- `npm run typecheck` : OK.
- Tests serveur `story.service`, `story_version.service`, `versioning` : OK.
- Échecs **antérieurs et indépendants de ces correctifs** :
  - `src/pages/CreateStoryPage.test.tsx` : `localStorage` indéfini dans `Header` (échoue aussi sans ces modifications).
  - `server/tests/services/prompt.helper.test.js` (fichier non suivi) : valeurs attendues (« 200-300 mots »…) différentes des prompts actuels.
- Recette manuelle conseillée (`npm run dev`) :
  - générer puis changer d'onglet ;
  - ouvrir le sélecteur de série en édition (rien ne doit être enregistré) ;
  - éditer une histoire 13-15 ;
  - changer la série puis vérifier le badge ;
  - déplacer une histoire vers un créneau occupé (série Alias) ;
  - restaurer une version, puis vérifier que l'état précédent figure dans l'historique.


---

# Audit 2 : génération automatique et gestion des images

*Audit du 7 octobre 2026. Parcours vérifié : `GenerationForm` → `useStoryGeneration` → `POST /api/generate/story` → `PromptHelper` → Gemini / Ollama → `storyParser` → `POST /api/stories` ; upload → stockage → affichage → nettoyage → PDF.*

## A. Génération automatique

| # | Gravité | Constat | État |
|---|---|---|---|
| A1 | 🔴 | **Style et longueur selon l'âge jamais appliqués** : `getStyleByAge` attendait `"4-6 ans"`, le front envoie `"4-6"`. Toutes les générations partaient avec un style vide et « L'histoire doit faire . » | ✅ corrigé |
| A2 | 🔴 | **Le parser amputait le texte** : les regex de métadonnées, non ancrées, coupaient toute ligne contenant « thème », « série », « description » ou « illustration ». Exemple vérifié : « Le thème du jour, c'est la pluie » devenait « Le ». | ✅ corrigé |
| A3 | 🔴 | **Prompt d'illustration perdu** : extrait puis jeté, stocké nulle part. Seule la 1re balise `[Illustration:]` était retirée du texte. | ✅ corrigé |
| A4 | 🟠 | **Jour mal reconnu** : regex stricte sur `**Jour de la Semaine :** `. En mode semaine, l'histoire était ignorée sans message ; sinon classée au lundi (`lundi`, `Lundi.` non reconnus). | ✅ corrigé |
| A5 | 🟠 | **Appels Gemini fragiles** : repli sur le modèle suivant même pour 400/401/403 (message final « overloaded » trompeur) ; `retries`/`delay` inutilisés ; pas de `maxOutputTokens` ni de contrôle de `finishReason` (texte tronqué enregistré) ; log du mauvais modèle ; pas de timeout ; identifiants de modèles douteux (`gemma-3-12b` sans `-it`, `gemma-3-2b`). | ✅ corrigé (suite) |
| A6 | 🟠 | **Audio** : en-tête WAV 24 kHz ajouté quel que soit le `mimeType` renvoyé : le fichier est corrompu si le repli renvoie du MP3 ou un autre taux d'échantillonnage. | ✅ corrigé (suite) |
| A7 | 🟡 | Langue forcée en `fr`, prompt uniquement en français, thèmes IA créés automatiquement ; `prompt.helper.test.js` (fichier non suivi) attend des valeurs qui ne correspondent plus au helper (« 200-300 mots », « Générez UNE SEULE histoire »…). | backlog |

## B. Gestion des images

| # | Gravité | Constat | État |
|---|---|---|---|
| B1 | 🔴 | **XSS stocké via upload** : le serveur se fiait au mimetype déclaré par le client et gardait l'extension d'origine. `evil.html` envoyé comme `image/png` était servi en HTML sur la même origine. | ✅ corrigé |
| B2 | 🟠 | **Chemin d'image faux** si le nom contient « uploads » (`lastIndexOf('uploads')`). Chemins stockés avec `\` sous Windows. | ✅ corrigé |
| B3 | 🟠 | **Racines `uploads` divergentes** : Multer (`__dirname`), service statique (`ENV_CONFIG`), nettoyage, import/export ZIP et PDF (`process.cwd()`). | ✅ corrigé |
| B4 | 🟠 | **Fichiers orphelins** : suppression d'image, d'histoire (cascade SQL) ou réinitialisation laissent les fichiers images et audio ; en création, l'image est envoyée avant que l'histoire existe. Seul le nettoyage manuel récupère l'espace. | ✅ corrigé (suite), sauf uploads de création abandonnés |
| B5 | 🟠 | **Interface Illustrer** : `accept="image/*"` alors que le serveur n'accepte que 4 types ; erreurs multer renvoyées en 500 sans message ; `alert()` en anglais. Reste : bouton « Upload » sans effet, pas de réordonnancement (positions avec trous ; la carte et le PDF prennent la 1re image), pas de confirmation de suppression. | ✅ corrigé (suite) |
| B6 | 🟡 | **Audio en production** : écrit dans `public/audio`, que Vite sert en dev mais qu'aucun serveur ne sert après `vite build`. | ✅ corrigé (suite) |
| B7 | 🟡 | **`scripts/init-db.sql` obsolète** : il manque `source`, `is_manually_edited`, `story_series.parent_series_id` / `locale` (ajoutés par les migrations de `database.js`). | ✅ corrigé (suite) |
| B8 | 🟡 | **Import ZIP** : les fichiers du dossier `images/` sont copiés dans `uploads` sans contrôle d'extension. Une archive piégée peut donc y déposer un `.html`. | ✅ corrigé (suite) |

## Correctifs réalisés (Audit 2)

### A1 : âge normalisé dans le prompt
[prompt.helper.js](../server/services/helpers/prompt.helper.js) : `getStyleByAge` accepte `"4-6"` comme `"4-6 ans"` et retombe sur le style 4-6 si l'âge est inconnu.

### A2 / A4 : parser fiabilisé
[storyParser.ts](../src/utils/storyParser.ts) :
- les métadonnées (Titre, Thème(s), Série, Tranche d'âge, Jour, Illustration) ne sont retirées que **comme lignes entières** : ancrées en début de ligne, `:` obligatoire, en gras ou non, avec ou sans espace avant le `:` ;
- suppression des regex destructrices (bloc `[ … ]` multi-lignes, lignes `"clé": …` quelconques) ; seul le JSON de thèmes identifié est retiré ;
- découpage « semaine » uniquement sur les lignes de titre ;
- [dayUtils.ts](../src/utils/dayUtils.ts) : `mapFrToEnDay` tolère casse, accents, ponctuation et gras (`lundi`, `Mardi.`, `**Mercredi**`) ;
- [useStoryGeneration.ts](../src/hooks/useStoryGeneration.ts) : en mode semaine, une histoire sans jour est signalée dans le journal (`segmentWithoutDay`) au lieu d'être ignorée en silence.

### A3 : prompt d'illustration conservé (colonne dédiée)
- migration à l'exécution `stories.illustration_prompt TEXT NULL` dans [database.js](../server/config/database.js), ajoutée aussi à [init-db.sql](../scripts/init-db.sql) ;
- [story.service.js](../server/services/story.service.js) : `create()` l'enregistre ; `update()` ne le modifie que s'il est envoyé ;
- toutes les descriptions `[Illustration: …]`, lignes « Illustration suggérée : » et 🎨 sont collectées dans `illustrationDescription`, puis envoyées en `illustrationPrompt` ;
- nouveau composant [IllustrationPromptCard.tsx](../src/components/Story/IllustrationPromptCard.tsx) (avec bouton « Copier »), affiché dans l'onglet Illustrations de l'édition et sur la page détail tant que l'histoire n'a pas d'image ;
- le TTS lit `content` : le prompt n'est jamais lu à voix haute. Le prompt n'est pas versionné (non inclus dans `story_versions`).

### B1 : upload sûr
- [upload.config.js](../server/config/upload.config.js) : liste blanche `jpeg/png/gif/webp`. L'extension écrite sur disque vient du **type validé**, jamais du nom du client. Erreur typée `InvalidFileTypeError` ;
- [app.js](../server/app.js) : `X-Content-Type-Options: nosniff` sur `/uploads`.

### B2 / B3 : chemins et racine uniques
- `toStoredPath()` dans [system.service.js](../server/services/system.service.js) : chemin relatif à la racine du projet, toujours avec `/` ;
- Multer, nettoyage, import/export ZIP et [addStoryPage.js](../server/lib/pdf/helpers/addStoryPage.js) (PDF) utilisent `ENV_CONFIG.UPLOADS_DIR` / `PROJECT_ROOT`. Le nettoyage compare des chemins normalisés (compatible avec les anciennes lignes contenant `\`). Le PDF gère aussi GIF et WebP.

### B5 : erreurs d'upload lisibles
- [system.routes.js](../server/routes/system.routes.js) : `uploadSingleImage` renvoie `400 { error }` pour une taille dépassée ou un type refusé ;
- front : `accept` aligné sur `ACCEPTED_IMAGE_TYPES` ([constants.ts](../src/constants.ts)), contrôle du type et de la taille avec toasts traduits à la place de `alert()`, message serveur affiché en cas d'échec ([useStoryData.ts](../src/hooks/useStoryData.ts), [CreateStoryPage.tsx](../src/pages/CreateStoryPage.tsx)).

### Tests ajoutés (Audit 2)
- `src/utils/storyParser.test.ts` (17 tests) :
  - phrases contenant les mots-clés conservées ;
  - métadonnées extraites et retirées ;
  - toutes les illustrations collectées ;
  - 3 variantes de ligne « Jour » ;
  - titre non confondu avec une phrase ;
  - découpage d'une semaine de 7 histoires ;
  - `mapFrToEnDay`.
- `server/tests/services/prompt.helper.age.test.js` : les 6 tranches acceptées dans les deux formats, valeur par défaut, longueur présente dans le prompt.
- `server/tests/services/uploads.test.js` :
  - extension issue du mimetype (`evil.html` + `image/png` → `.png`) ;
  - webp accepté, svg refusé ;
  - `toStoredPath` ;
  - chemin correct même avec « uploads » dans le nom.
- `story.service.test.js` : `create` enregistre `illustration_prompt` ; `update` sans le champ ne l'écrase pas.

### Vérification
- `npm run typecheck` : OK.
- Client : 53/54 ; serveur : 66/73. Les échecs sont **tous antérieurs** : `CreateStoryPage.test.tsx` (`localStorage`) et les 7 tests de `prompt.helper.test.js` (attentes obsolètes, fichier non suivi).
- Recette manuelle conseillée (`npm run dev`) :
  - générer une histoire puis une semaine : texte complet, jour correct, prompt d'illustration visible ;
  - uploader un PNG et un WebP, puis un `.html` renommé en `.png` : il doit être enregistré en `.png` et jamais servi en HTML ;
  - lancer le nettoyage des images ;
  - exporter un PDF avec illustration.

## Correctifs réalisés (Audit 2, suite du backlog)

### A5 : appels Gemini robustes
[gemini.service.js](../server/services/gemini.service.js), mécanisme commun `_generateWithFallback` pour le texte et l'audio :
- **400/401/403 = erreur fatale** (`GeminiFatalError`) : pas de repli, le vrai message de l'API remonte jusqu'au journal de génération ;
- **429/5xx** : jusqu'à 2 nouvelles tentatives sur le même modèle avec backoff exponentiel (2 s, 4 s), puis modèle suivant ;
- **404, erreur réseau, timeout** : modèle suivant. Timeout configurable `GEMINI_TIMEOUT_MS` (180 s par défaut) ;
- `maxOutputTokens` : 8 192 pour une histoire, 32 768 pour une semaine ;
- `finishReason` contrôlé :
  - blocage (`SAFETY`, `RECITATION`…) → erreur explicite ;
  - `MAX_TOKENS` → réponse marquée `truncated`, et le front ajoute un avertissement au journal (`logs.truncated`) ;
- le modèle réellement utilisé est renvoyé et journalisé ;
- liste des modèles corrigée (`gemma-3-12b-it`, `gemma-3-4b-it`, retrait de `gemma-3-2b`) et surchargeable avec `GEMINI_MODELS` / `GEMINI_AUDIO_MODELS`. `gemma-4-31b` et `gemini-3.x-flash` n'ont pas pu être vérifiés (absents de `scripts/models.txt`, plus ancien) : relancer `node scripts/list_models.js` ;
- [local_llm.service.js](../server/services/local_llm.service.js) (Ollama) : timeout `OLLAMA_TIMEOUT_MS` (10 min par défaut) avec message clair, réponse vide refusée, troncature détectée (`done_reason: length`).

### A6 : audio au bon format, et texte lu nettoyé
- `toPlayableAudio()` : en-tête WAV seulement pour du PCM brut, avec le taux lu dans le `mimeType` (`rate=…`). MP3, OGG et WAV sont gardés tels quels, avec la bonne extension ;
- `buildSpeechText()` ([story.service.js](../server/services/story.service.js)) retire avant la synthèse vocale :
  - les balises HTML (éditeur riche) et les entités ;
  - toutes les descriptions d'illustration (`[Illustration: …]`, « Illustration suggérée : », 🎨) ;
  - le markdown ;
- page détail : plus de `type="audio/mpeg"` codé en dur, et le lecteur se recharge quand l'audio change.

### B4 : cycle de vie des fichiers
- nouveau helper [file_cleanup.helper.js](../server/services/helpers/file_cleanup.helper.js) : supprime un fichier **seulement si plus aucune ligne ne le référence**, et uniquement dans `uploads/` ou l'ancien `public/audio/` (protection contre la traversée de répertoires) ;
- branché sur la suppression d'une illustration, la suppression d'une histoire (images + audio), la régénération audio (ancien fichier), l'enregistrement et la restauration d'une histoire (qui réinitialisent l'audio) ;
- réinitialisation des données : supprime aussi les séries, puis lance le nettoyage des fichiers. Le nettoyage tient compte des fichiers audio référencés ;
- reste : images envoyées en création puis abandonnées (récupérées par le nettoyage manuel).

### B5 (suite) : interface Illustrations
- bouton « Upload » inutile retiré (l'envoi part au choix du fichier) ;
- confirmation avant suppression d'une illustration ;
- **réordonnancement** par flèches, avec indication que la 1re image sert de couverture :
  - en édition : `PUT /api/stories/:id/illustrations/order`. Le serveur vérifie que la liste correspond exactement aux illustrations de l'histoire, puis réécrit les positions 0..n-1 sans trous ;
  - en création : réordonnancement local.

### B6 : audio servi en production
Les nouveaux fichiers sont écrits dans `uploads/audio/` (servi par Express via `/uploads`, et par Vite en dev). Le nom contient un horodatage, ce qui évite le cache navigateur après une régénération. Les anciens fichiers restent accessibles via la route `/audio` ajoutée dans [app.js](../server/app.js).

### B7 : schéma d'installation
[init-db.sql](../scripts/init-db.sql) contient désormais tout le schéma réel : `stories.source`, `stories.is_manually_edited`, `story_versions.is_manually_edited`, `story_series.parent_series_id` / `locale`, `stories.illustration_prompt`.

### B8 : import ZIP filtré
Seules les extensions image (jpg, jpeg, png, gif, webp) et audio (wav, mp3, ogg, webm) sont copiées dans `uploads/` ; les autres fichiers sont ignorés et journalisés.

### Tests ajoutés (suite)
- `server/tests/services/gemini.service.test.js` :
  - clé invalide sans repli ;
  - nouvelle tentative sur 503 ;
  - modèle suivant sur 404 ;
  - troncature signalée et budget « semaine » ;
  - réponse bloquée ;
  - `toPlayableAudio` (PCM → WAV au bon taux, MP3 conservé).
- `server/tests/services/file_cleanup.test.js` :
  - résolution des chemins et refus de la traversée ;
  - fichier supprimé seulement s'il n'est plus référencé ;
  - `delete` d'une histoire qui supprime ses fichiers après la ligne ;
  - `reorderIllustrations` (ordre écrit, liste incohérente refusée) ;
  - `buildSpeechText` (HTML et markdown).
- Mocks de `upload.config.js` complétés dans `generation.test.js`, `pdf.test.js` et `system.test.js`.

### Vérification (suite)
- `npm run typecheck` : OK.
- Client : 53/54 ; serveur : 82/89. Les échecs restants sont **antérieurs** :
  - `CreateStoryPage.test.tsx` (`localStorage` indéfini dans `Header`) ;
  - les 7 tests de `prompt.helper.test.js`.
- **À propos de `prompt.helper.test.js`** : ce fichier n'a pas simplement des valeurs périmées. Il décrit un prompt **refactoré qui n'existe nulle part**, ni dans le code ni dans l'historique git (« Livre d'éveil », « Générez UNE SEULE histoire », « RÉSUMÉ PRÉCÉDENT », « SPÉCIFICITÉS DU JOUR »…). Il ressemble à la spécification d'une réécriture du prompt à venir : il n'a donc **pas été modifié**. À décider : implémenter ce prompt, ou aligner le test sur le prompt actuel.
- Recette manuelle conseillée (`npm run dev`) :
  - générer avec une clé Gemini invalide : message clair, sans parcourir tous les modèles ;
  - générer une semaine ;
  - générer puis régénérer l'audio : l'ancien fichier disparaît, le lecteur se met à jour ;
  - réordonner, puis supprimer des illustrations ;
  - supprimer une histoire : ses fichiers doivent disparaître de `uploads/` ;
  - importer un ZIP contenant un `.html` : le fichier doit être ignoré.

## Backlog de l'audit 2
Les deux points restants sont traités dans l'audit 3 ci-dessous.

---

# Audit 3 : prompt JSON et fin du backlog

*7 octobre 2026. Décisions : sortie JSON structurée avec repli sur le parser texte ; histoires en français seulement ; `prompt.helper.test.js` réécrit pour le nouveau prompt.*

## Nouveau prompt de génération
**Avant** : deux gros blocs presque identiques (histoire seule / semaine), écrits pour Gemma 3. Ils demandaient un format texte balisé (`**Titre de l'Histoire :**`…), retrouvé ensuite par des regex fragiles. Le contexte de la veille correspondait aux 3 000 *premiers* caractères de l'histoire précédente.

**Après** ([prompt.helper.js](../server/services/helpers/prompt.helper.js)) :
- `buildSystemInstruction()` : rôle, règles de sécurité pour les enfants (pas de violence ni de peur excessive, faits exacts), règles d'écriture (montrer plutôt qu'expliquer, une notion par histoire, pas de morale lourde), « JSON uniquement, en français ».
- `buildStoryPrompt()` : un seul gabarit en sections courtes, `MISSION`, `PARAMÈTRES`, `PUBLIC`, `CONTINUITÉ`, `SPÉCIFICITÉS DU JOUR`, `ILLUSTRATION` et `FORMAT DE SORTIE`. Il fait environ 3,4 k caractères pour une semaine.
- `getAgeProfile()` (l'alias `getStyleByAge` est conservé) : longueur, nombre de paragraphes, style d'écriture et style d'illustration par tranche d'âge (« Livre d'éveil » → « Young Adult »). Les longueurs sont revues pour qu'une semaine tienne dans le budget de tokens.
- La continuité passe par le **résumé** (`summary`) de l'histoire de la veille. Sans résumé (repli texte), on garde la *fin* du chapitre précédent.

## Sortie JSON
- Schéma commun : [story_schema.js](../server/services/helpers/story_schema.js), `{ stories: [{ day, title, summary, themes, paragraphs, illustration_prompt }] }`.
- [gemini.service.js](../server/services/gemini.service.js) : `buildStoryRequestBody(model)`.
  - Modèles `gemini-*` : `systemInstruction`, plus `responseMimeType: application/json` et `responseSchema`.
  - Modèles `gemma-*` : l'instruction est placée dans le message, sans mode JSON. Ces modèles refusent ces champs avec une erreur 400, qui est fatale.
  - Les parties « thought » des modèles qui réfléchissent sont ignorées.
- [local_llm.service.js](../server/services/local_llm.service.js) (Ollama) : `system` + `format` = schéma JSON (sortie contrainte).
- [story_output.helper.js](../server/services/helpers/story_output.helper.js) : extrait le JSON même s'il est entouré de blocs de code ou de texte. Normalise les jours et les thèmes, et retire les histoires vides. `generateFromAI` renvoie `stories` (ou `null`, et dans ce cas le client lit le texte avec `storyParser`).
- Front : les paragraphes deviennent du HTML `<p>` (éditeur riche, DOMPurify, TTS déjà compatibles). Le journal signale quand la lecture du texte de secours est utilisée.

## Backlog traité
| # | Point | Correctif |
|---|---|---|
| P1-1 | Progression et faux succès | Barre de progression, compteurs créées / échecs / ignorées. Une erreur n'arrête que l'élément concerné (Gemini comme Ollama). Récapitulatif cliquable, sans redirection automatique ; message d'erreur si rien n'a été créé ([useStoryGeneration.ts](../src/hooks/useStoryGeneration.ts), [StoryGenerationTab.tsx](../src/components/Story/CreateStory/StoryGenerationTab.tsx)) |
| P1-2 | Langue en dur | Constante `GENERATION_LOCALE = 'fr'` (choix utilisateur : français seulement) |
| P1-3 | Retour / suppression → accueil | « Retour » = page précédente, sinon `/stories` ; après suppression → `/stories`. Filtres de la bibliothèque dans l'URL dans les deux sens (`useSearchParams`, ajout de `seriesId` et `search`) |
| P1-4 | Alias silencieux | `resolveSlot()` renvoie l'alias créé ; création et mise à jour renvoient `aliasSeries` ; toast et ligne de journal. Collision limitée à la même série (règle `OR series_id IS NULL` supprimée) |
| P1-5 | Perte du travail | Passage à `createBrowserRouter`. Hook [useUnsavedChangesGuard](../src/hooks/useUnsavedChangesGuard.tsx) (`useBlocker` + `beforeunload`) en création (texte, images, génération en cours) et en édition |
| P1-6 | Audio effacé sans prévenir | Avertissement sous le bouton Enregistrer quand l'histoire a un audio |
| P1-7 | Navigation précédent / suivant | Filtre sur la langue ; tri sur (semaine, jour), donc le dimanche mène au lundi suivant |
| P1-8 | Illustrations / versions | L'onglet Illustrations indique que l'enregistrement est immédiat ; confirmation avant restauration, avec aperçu et alerte si des modifications ne sont pas enregistrées |
| P2-9 | i18n | Audio, « Toute la semaine » (`ALL_WEEK`), jours de génération, toasts de `useStoryData`, PDF et thèmes, messages zod (clés traduites par `FormMessage`), fallbacks en dur |
| P2-10 | Toasts / mode sombre | Uniquement `sonner` (le toaster shadcn est supprimé). `useDarkMode` observe la classe `dark` : les écouteurs `darkModeChanged` ne recevaient aucun événement |
| P2-11 | Formulaires | [MultiSelect](../src/components/Common/MultiSelect.tsx) (Popover + Checkbox) à la place des `<select multiple>` ; langue en Select fr/en ; jour et semaine obligatoires |
| P2-12 | Thèmes découpés sur la virgule | `GROUP_CONCAT` supprimé ; thèmes chargés en une requête `IN (...)` dans `_hydrateStories` |
| P2-13 | README | Nom imagitales, port `API_PORT`, variables IA, tableau des scripts réparé, sections génération, séries / alias, versions et fichiers |
| A2-1 | Uploads de création abandonnés | `cleanupImages({ minAgeMs })` ; purge au démarrage puis toutes les 24 h des fichiers non référencés de plus de 24 h ([server.js](../server.js)) |
| A2-2 | `prompt.helper.test.js` | Réécrit pour le nouveau prompt |

**Écart avec le plan** : la valeur « aucun filtre » de la bibliothèque reste `'all'` et non `''`. Les `Select` Radix n'acceptent pas de valeur vide ; `'all'` est désormais la seule valeur utilisée, et un paramètre absent de l'URL vaut `'all'`.

## Tests
- Réécrits : `prompt.helper.test.js` (13 tests) et `prompt.helper.age.test.js`.
- Nouveaux :
  - `story_output.helper.test.js` (8) ;
  - `buildStoryRequestBody` Gemini / Gemma et parties « thought » (`gemini.service.test.js`) ;
  - `getNeighbors`, thèmes contenant une virgule, alias renvoyé, collision dans la même série (`story.service.test.js`) ;
  - purge par âge (`uploads.test.js`) ;
  - jour / semaine / langue obligatoires et messages en clés i18n (`formSchema.test.ts`).
- `CreateStoryPage.test.tsx` repasse au vert :
  - `localStorage` en mémoire dans `src/setupTests.ts` (le `localStorage` de Node masquait celui de jsdom) ;
  - routeur de données (`createMemoryRouter`).

## Vérification
- `npm run typecheck` : OK. `vite build` : OK.
- Client : **56/56**. Serveur : **111/111**.
- ESLint : pas de configuration dans le projet (`eslint` échoue avant de lint), point antérieur à ces changements.
- À faire avec de vraies clés (non vérifié ici) :
  - une histoire sur un modèle `gemini-3.x-flash` (JSON par schéma) ;
  - une histoire sur `gemma-4-31b-it` (JSON par le prompt) ;
  - une semaine Ollama `gemma4:e2b` (`format`, résumé transmis d'un jour à l'autre).
- Recette manuelle (`npm run dev`) :
  - progression et récapitulatif ;
  - garde de sortie : lien du header, retour arrière, fermeture de l'onglet ;
  - filtres de la bibliothèque après un rechargement ;
  - toast d'alias ;
  - passage du dimanche au lundi ;
  - confirmation de restauration ;
  - interface en anglais.

## Restant
- Rien du backlog des audits 1 et 2.
- Optionnel :
  - le paquet `@radix-ui/react-toast` n'est plus utilisé (peut être retiré du `package.json`) ;
  - la clé `create.generate.holdCtrl` n'est plus utilisée ;
  - ajouter une configuration ESLint.

---

# Audit 4 : thèmes d'histoire

*7 octobre 2026. Décisions :*
- *l'IA réutilise en priorité les thèmes existants ; un nouveau thème est marqué « à revoir » ;*
- *chaque semaine est liée à un thème ;*
- *une seule page « Thèmes » à deux onglets ;*
- *le thème principal est visible et modifiable (étoile).*

## Constats
| Domaine | Avant |
|---|---|
| Données | Pas d'unicité du nom (« Nature » / « nature »). `update()` ignorait l'icône et écrasait `created_at`. Fusion des doublons sur le nom exact, sans transaction : elle cassait si une histoire avait les deux thèmes et effaçait l'historique des versions par cascade. |
| Suppression | Un thème utilisé ne pouvait pas être supprimé (400 générique), sans proposition de réaffecter ses histoires. |
| Affichage | 4 styles de badge, texte blanc sur n'importe quelle couleur, icône jamais affichée. Thème principal implicite (seulement à l'édition) et invisible. Badges pas mis à jour après une modification de thème. |
| IA | Chaque nouvelle formulation créait un thème. |
| Semaines | Texte libre relié aux thèmes par le nom exact. Bouton « tout enregistrer » bloqué par une seule semaine vide. Dates toujours en français. |
| Code | 8 composants morts, un `ThemeContext` surchargé, des types `Theme` redéclarés, une recherche faite deux fois, un bouton « Effacer » sans effet. |

## Serveur
- **Migration** ([theme.migration.js](../server/config/theme.migration.js), idempotente au démarrage) :
  - ajout de `themes.normalized_name` (avec **index unique**), `updated_at`, `source` (`manual` / `ai`), `needs_review`, et passage de l'icône à 16 caractères ;
  - fusion automatique des doublons existants : on garde le thème le plus utilisé, sans perte de liens ni de versions ;
  - ajout de `weekly_themes.theme_id` (FK `SET NULL`), chaque semaine étant rattachée au thème de même nom (créé si besoin).
- **Règles de nom** ([theme_name.helper.js](../server/services/helpers/theme_name.helper.js), copie conforme dans [themeName.ts](../src/utils/themeName.ts)) : majuscules, accents, articles en tête et singulier / pluriel sont ignorés (« L'Océan » = « les océans »).
- **[theme.service.js](../server/services/theme.service.js)** :
  - `create` renvoie le thème existant si le nom est déjà pris (200 au lieu de 201) ;
  - `update` est partiel (icône comprise) ; 409 `{ conflictWith }` si le nom est pris, 404 si le thème est inconnu ;
  - `delete(id, { reassignTo })` : 409 `{ storyCount }` sans thème de remplacement ;
  - `mergeThemes` en transaction ([theme_merge.helper.js](../server/services/helpers/theme_merge.helper.js)) : liens en double supprimés, principal conservé, versions et semaines réaffectées ;
  - `findDuplicateGroups` ; liste avec tri (nom / usage / récents) et filtres « à revoir » / « inutilisés ».
- **Erreurs typées** (`ValidationError`, `NotFoundError`, `ConflictError`) dans [error.middleware.js](../server/middleware/error.middleware.js).
- **Routes** :
  - `GET /api/themes/duplicates`
  - `POST /api/themes/merge`
  - `DELETE /api/themes/:id?reassignTo=`
  - `PUT` et `DELETE /api/weekly-themes/:week`

  Les routes `merge-duplicates` et `PUT /:id/stories` sont supprimées.
- **Histoires** : `normalizeStoryThemes` (ids uniques, exactement un thème principal). L'icône est chargée dans les listes, le détail et les versions.
- **Import ZIP** : un thème importé réutilise le thème local de même nom et ses liens sont remappés. Le cache des thèmes est invalidé après l'import et la réinitialisation.
- **Génération IA** : section « THÈMES ASSOCIÉS » du prompt, avec le thème de la semaine en premier et la liste des thèmes existants (80 au plus, les plus utilisés d'abord) à réutiliser tels quels.

## Front : briques réutilisables (`src/components/Theme/`)
- **`ThemeBadge`** : le seul badge de l'application. Couleurs lisibles calculées par [themeColors.ts](../src/utils/themeColors.ts) (contraste WCAG) ; affiche l'icône et l'étoile du principal ; peut servir de lien vers `/stories?theme=`.
- **`ThemeBadgeList`** : principal en premier, « +N » au-delà d'un maximum. Les helpers `sortStoryThemes` et `primaryStoryTheme` en sont exportés.
- **`ThemeSelect`** (choix simple) et **`ThemeMultiSelect`** (étoile du principal) : recherche sans accents, nombre d'histoires, création à la volée avec alerte « thème proche », thème de la semaine épinglé.
- **Dialogues** : `ThemeFormDialog` (aperçu en direct, conflit 409 transformé en proposition de fusion), `ThemeDeleteDialog` (suppression ou fusion avec thème de remplacement), `ThemeMergeDialog` (groupes de doublons, choix du thème à garder).
- **Sélecteurs** : `ThemeColorPicker` (palette lisible + couleur personnalisée) et `ThemeIconPicker`.
- **[useThemes.ts](../src/hooks/useThemes.ts)** : clés de requête centralisées ; chaque mutation rafraîchit les thèmes, les semaines et les histoires. [weekUtils.ts](../src/utils/weekUtils.ts) gère les semaines ISO et les dates dans la langue de l'interface.

## Front : écrans
- **Page `/themes`** ([ThemesPage.tsx](../src/pages/ThemesPage.tsx)). L'onglet, la recherche, le tri, le filtre et l'année sont dans l'URL. `/theme` et `/weekly-themes` redirigent vers cette page, et le menu n'a plus qu'un seul lien.
  - **Onglet Thèmes** : recherche, tri, filtres rapides avec compteurs, bannière des doublons, cartes avec lien « N histoires » et menu ⋯ (modifier, fusionner dans…, supprimer), aussi sur mobile.
  - **Onglet Calendrier** : semaines ISO groupées par mois, semaine en cours mise en avant, enregistrement immédiat par semaine, création de thème à la volée, lien vers les histoires de la semaine.
- **Parcours des histoires** :
  - carte d'histoire (3 badges au plus) ;
  - page détail (badges qui sont des liens, thème de la semaine) ;
  - timeline (thème principal au lieu du premier) ;
  - aperçu de création et liste PDF ;
  - filtres de la bibliothèque et du PDF (`ThemeSelect`).
- **Éditeur** : `ThemeMultiSelect` avec l'étoile. Le formulaire envoie `{ id, isPrimary }` à la création comme à l'édition.
- **Génération** : rapprochement des noms proches, thème de la semaine en principal, nouveaux thèmes créés avec `source: 'ai'` (« à revoir »).
- **Supprimés** :
  - `Themepage`, `WeeklyThemesPage`, `ThemeContext` ;
  - ThemeManager, AddThemeSection, ThemeHeader, FilterSection, ThemePicker, ThemeGrid, ThemeCard, ThemeDialog, ConfirmDeleteDialog, WeeklyThemeInput ;
  - StoryMetadataCard ;
  - `IllustrationManager` (import cassé depuis le premier commit).

**Écart avec le plan** : le filtre de thème du PDF ne propose que les thèmes des histoires chargées. L'export ne porte que sur ces histoires : proposer tous les thèmes donnerait des sélections vides.

## Typecheck : correction importante
`npm run typecheck` (`tsc --noEmit`) ne vérifiait **aucun fichier** : `tsconfig.json` ne contient que des `references`, avec `"files": []`. Les « typecheck OK » des audits 2 et 3 n'avaient donc aucune valeur. Le script lance maintenant `tsc --noEmit -p tsconfig.app.json`. Les 11 erreurs révélées sont corrigées (dont `IllustrationManager`, cassé depuis le premier commit, supprimé).

## Tests
- Serveur :
  - `theme_name.helper.test.js` ;
  - `theme.service.test.js` (création existante, mise à jour partielle et 409, suppression 409 / réaffectation, fusion sans doublon de lien, groupes de doublons, cache) ;
  - `weeklyTheme.service.test.js` ;
  - `themes.test.js` réécrit (routes 200 / 201 / 400 / 404 / 409) ;
  - `normalizeStoryThemes` ;
  - section THÈMES ASSOCIÉS du prompt.
- Client :
  - `theme.test.ts` (noms, couleurs, contraste) ;
  - `ThemeComponents.test.tsx` (badge, étoile du principal, recherche sans accents, alerte doublon, création) ;
  - `StoryCard.test.tsx` adapté.

## Vérification
- `npm run typecheck` (réel) : OK. Client : **70/70**. Serveur : **147/147**. `vite build` : OK.
- À faire sur une vraie base, en premier lieu : démarrer le serveur sur une base qui contient des doublons, puis vérifier dans les logs la fusion, l'index unique et le rattachement des semaines.
- Recette manuelle (`npm run dev`) :
  - créer un thème, le renommer vers un nom existant (proposition de fusion) ;
  - supprimer un thème utilisé (réaffectation) ;
  - fusionner un groupe de doublons ;
  - choisir l'étoile du principal dans l'éditeur ;
  - modifier une couleur : les badges de la bibliothèque changent tout de suite ;
  - calendrier : lier, retirer et créer à la volée ;
  - générer une semaine avec l'IA ;
  - vérifier les anciennes URL, le mobile et le mode sombre.

---

# Audit 4 bis : étiquettes d'histoire et sujet de la semaine

*7 octobre 2026, après recette de l'audit 4. Retours : on ne voit plus les histoires d'un thème, pas de suppression en masse, trop de semaines dans le calendrier, impossible de saisir librement le thème d'une semaine, confusion entre thème d'histoire et thème de la semaine.*

**Décisions**
- Deux notions séparées :
  - l'**étiquette** (table `themes`) : plusieurs par histoire ;
  - le **sujet de la semaine** (table `weekly_themes`) : texte libre et description, qui guide l'écriture.
- Le lien `weekly_themes.theme_id` de l'audit 4 est abandonné.
- Deux pages : « Étiquettes » (`/themes`) et « Programme » (`/weekly-themes`).
- À la génération, le sujet guide seulement l'écriture : les étiquettes viennent de l'IA, choisies parmi l'existant.
- Les semaines numérotées au-delà de 53 sont des erreurs héritées.

## Données
- **Migration** ([theme.migration.js](../server/config/theme.migration.js)) : le nom et la description de l'étiquette liée sont recopiés dans la semaine (les renommages sont conservés), puis la FK et la colonne `theme_id` sont supprimées.
  - Les étiquettes créées par l'audit 4 à partir des semaines restent ; elles apparaissent dans « Inutilisés » et se suppriment en masse.
- **[weeklyTheme.service.js](../server/services/weeklyTheme.service.js)** :
  - `setWeek(week, { name, description })` : nom obligatoire (150 caractères au plus), description de 500 au plus, semaine de 1 à 53 ;
  - `clearWeek` accepte toute semaine ≥ 1, pour nettoyer les semaines héritées.
- La fusion et la suppression d'étiquettes ne touchent plus `weekly_themes`. L'import ZIP ignore le `theme_id` des anciens exports.
- **Nouvelle route** `POST /api/themes/bulk-delete { ids }` (`themeService.deleteMany`), en une transaction : seules les étiquettes sans histoire sont supprimées, les autres reviennent dans `skipped`.
- `GET /api/themes/:id/stories` renvoie des colonnes légères (`id, title, age_group, week_number, day_order, locale`).

## Génération
- Prompt : « Sujet de la semaine » (et « Précisions sur le sujet » si une description existe) dans les paramètres. La section `## ÉTIQUETTES` ne demande plus que la première étiquette soit le sujet.
- Front : les étiquettes de l'histoire sont celles de l'IA, la première étant la principale. Si l'IA n'en propose aucune, le sujet sert d'étiquette en dernier recours (une histoire en exige une), et le journal le signale.

## Écrans
- **Programme** ([WeeklyTopicsPage](../src/pages/WeeklyTopicsPage.tsx), [WeeklyTopicCalendar](../src/components/WeeklyTopics/WeeklyTopicCalendar.tsx), [WeeklyTopicRow](../src/components/WeeklyTopics/WeeklyTopicRow.tsx)) :
  - 52 ou 53 semaines selon l'année ISO, groupées par mois ;
  - champ « Sujet » éditable directement et description dépliable ;
  - enregistrement à la sortie du champ (Entrée valide, Échap annule), avec un indicateur ; vider le champ retire la semaine ;
  - encart « semaines hors calendrier » pour retirer les semaines > 53.
- **Étiquettes** : la page n'a plus d'onglets (un ancien `?tab=calendar` redirige vers le Programme).
  - « N histoires » déplie la liste des histoires (âge, S12 · Lundi, titre en lien ; au-delà de 10, lien vers la bibliothèque) ;
  - case à cocher sur les étiquettes inutilisées, barre de sélection collante (« Tout sélectionner », « Supprimer ») et confirmation qui liste les étiquettes.
- Menu : « Étiquettes » et « Programme ». La page détail affiche « Sujet de la semaine : … » en texte. Les sélecteurs n'épinglent plus d'étiquette de la semaine (prop `pinned` supprimée). Les sélecteurs de semaine (bibliothèque, éditeur) vont de 1 à 53.

## Vérification
- Typecheck : OK. Client : **76/76**. Serveur : **155/155**. `vite build` : OK.
- Nouveaux tests :
  - `WeeklyTopics.test.tsx` : 53 semaines en 2026, semaine 88 à part, retrait, enregistrement à la perte du focus, vidage ;
  - `ThemeListItem.test.tsx` : case seulement si inutilisée, dépliage des histoires ;
  - `deleteMany` et la route `bulk-delete` ;
  - `weeklyTheme.service` réécrit ;
  - prompt : le sujet est un paramètre, pas une étiquette.
- À faire sur la vraie base : démarrer le serveur, vérifier le log « weekly_themes.theme_id dropped » et que les sujets sont intacts.
- Recette :
  - Programme : saisir, recharger, vider, retirer les semaines hors calendrier ;
  - Étiquettes : déplier, puis filtre « Inutilisés » → tout sélectionner → supprimer ;
  - générer une semaine avec l'IA.

---

# Audit 5 : génération IA d'après les logs

*7 octobre 2026. Sources :*
- *`server/logs/ai-*.log` (5 jours de génération), `access-*.log` et `server/debug/logs.jsonl` ;*
- *la génération relancée à 23:02 (heure locale) et la console du serveur ;*
- *les quotas du niveau gratuit ;*
- *la liste réelle des modèles de la clé (ListModels).*

## Constats
| # | Constat | Cause |
|---|---|---|
| 1 | Génération de 23:02 : **10 min 40 s**. Gemma 31B puis 26B abandonnées après 180 s chacune, puis des 503 « high demand » en série sur Gemini 3.8, 3.7 et 3.6 Flash ; Gemini 3.5 Flash a fini par répondre. | Les Gemma (lentes, avec thinking) étaient en tête ; chaque 503 était retenté 3 fois ; rien ne mémorisait les échecs. |
| 2 | Histoires trop courtes pour 13-15 ans : environ 300 mots à 20:58 (ancien prompt), 457 à 672 mots à 23:02, pour une cible de 900 à 1100. | La semaine entière était demandée en **un seul appel** : le modèle comprime. Seul Ollama passait en jour par jour. |
| 3 | Les corrections des audits 3 et 4 fonctionnent en réel : JSON valide, illustration enregistrée, étiquette principale marquée, **aucune nouvelle étiquette** (contre 11 créées à 20:58). | — |
| 4 | 19 fausses générations (`POST /api/generate/story` en environ 10 ms, depuis 127.0.0.1) dans les logs d'accès. | Les tests serveur écrivaient dans les vrais logs. |
| 5 | « Ollama ListModels-Error: fetch failed » à chaque ouverture de « Créer ». | Ollama n'est pas lancé : sans conséquence. |

## Quotas du niveau gratuit (relevé du 7 octobre)
| Modèles | Requêtes/min | Requêtes/jour | Remarques |
|---|---|---|---|
| gemini-3.5-flash-lite, gemini-3.1-flash-lite | 15 | 500 | JSON natif |
| gemini-3.8 / 3.7 / 3.6 / 3.5-flash, gemini-3-flash-preview, gemini-2.5-flash | 5 | 20 chacun | JSON natif |
| gemma-4-31b-it, gemma-4-26b-a4b-it | 30 | 14 400 | lentes, pas de JSON natif, 16K tokens d'entrée par minute |
| Pro (2.5, 3.1) | 0 | 0 | indisponibles |

## Corrections
- **Ordre des modèles** ([gemini.service.js](../server/services/gemini.service.js)) : d'abord les Flash Lite, puis les Flash, puis Gemma en dernier recours. L'ordre se surcharge avec `GEMINI_MODELS`.
- **Thinking réduit** pour la narration : `thinkingLevel: low` pour Gemini 3.x et `thinkingBudget: 0` pour 2.5. Un modèle qui refuse ce réglage (400) est rappelé sans lui.
- **Mémoire des échecs** ([model_cooldown.helper.js](../server/services/helpers/model_cooldown.helper.js)) :
  - 503 : une seule nouvelle tentative, puis modèle écarté 5 min ;
  - 429 quota du jour : modèle écarté jusqu'à minuit (heure du Pacifique) ;
  - 429 par minute : attente du délai suggéré s'il fait 20 s au plus, sinon modèle suivant ;
  - délai dépassé : modèle écarté 10 min ; 404 : 1 h.
  - Le log `Story` liste les modèles écartés et pourquoi.
- **Délai** : 120 s par appel (un appel = une histoire).
- **Semaine toujours jour par jour** ([useStoryGeneration.ts](../src/hooks/useStoryGeneration.ts), [generationPlan.ts](../src/utils/generationPlan.ts)) :
  - 7 appels, quel que soit le fournisseur ; chaque jour reçoit le résumé de la veille ;
  - le premier jour reçoit `weekSeries` : « Cette histoire ouvre une aventure suivie sur 7 jours » au lieu de « aventure autonome » ;
  - les appels au cloud commencent à au moins 12 s d'intervalle (5 requêtes par minute), et le journal affiche la pause.
- **Longueur visible** :
  - le log IA `Story-Parsed` donne le modèle, le nombre de mots de chaque histoire et la cible de l'âge (`PromptHelper.getTargetWords`) ;
  - le journal de génération signale une histoire de moins de la moitié du minimum.
- **Tests sans logs** : `ENV_CONFIG.FILE_LOGGING` est faux sous Vitest pour les trois loggers.

## Vérification
- Typecheck : OK. Client : **79/79**. Serveur : **169/169**. `vite build` : OK.
- Aucune ligne écrite dans `server/logs/access-<date>.log` pendant les tests.
- **À faire** : relancer une semaine en 13-15 ans, puis vérifier dans `ai-<date>.log` :
  - 7 entrées `Story` sur Flash Lite ou Flash, chacune en moins de 2 min ;
  - 7 entrées `Story-Parsed` avec environ 900 mots ou plus ;
  - pas de passage par Gemma.

---

# Audit 6 : continuité de la semaine

*7 octobre 2026. Semaine générée à 23:22 : « Les animaux qui hibernent », 4-6 ans, jour par jour avec Gemini 3.5 Flash Lite.*

## Constat : les histoires ne se suivaient pas
| Jour | Fin (suspense laissé) | Début du lendemain |
|---|---|---|
| Lundi | suit de mystérieuses empreintes | Mardi : va voir un chêne creux, empreintes oubliées |
| Mardi | un tas de feuilles bouge : qui est-ce ? | Mercredi : rend visite au loir et au hérisson, tas oublié |
| Mercredi | s'approche d'un tas de feuilles qui bouge | Jeudi : « le lit du hérisson était vide hier » |
| Jeudi | écoute à l'entrée d'un terrier | Vendredi : « hier, le lit était vide » (encore) |

Ce qu'on observe aussi :
- mercredi, jeudi et vendredi recommencent la même enquête ;
- le dimanche reprend le titre du lundi ;
- le faon est présenté de nouveau chaque jour ;
- le samedi est écrit en un seul bloc de 1459 caractères.

**Causes.**
- Chaque jour ne recevait que le résumé de la veille : une phrase qui décrit le point de départ, pas la fin.
- Il ne recevait ni la dernière scène, ni les jours d'avant, ni les titres déjà pris.
- Il n'y avait aucun plan de la semaine : chaque appel réinventait son intrigue.

## Corrections
- **Plan de la semaine**. Le lundi renvoie aussi `week_plan` : 7 étapes, une par jour.
  - Une seule intrigue qui progresse : suspense du lundi au jeudi, résolution le vendredi, activité le samedi, conclusion le dimanche.
  - Le champ est obligatoire dans le schéma JSON quand on le demande, et placé avant l'histoire pour que le modèle planifie d'abord ([story_schema.js](../server/services/helpers/story_schema.js) : `geminiResponseSchema` et `jsonSchema`).
  - Il est lu par `extractWeekPlan` ([story_output.helper.js](../server/services/helpers/story_output.helper.js)).
- **Contexte de chaque jour** (`getWeekSeriesContinuity` dans [prompt.helper.js](../server/services/helpers/prompt.helper.js)) :
  - le plan, et l'étape du jour (« Aujourd'hui (Mercredi) : … ») ;
  - tout ce qui a déjà été raconté (jour, titre, résumé) ;
  - la **fin d'hier citée mot pour mot**.
  - Consignes :
    - reprendre exactement là où s'arrête la fin d'hier et répondre à son suspense ;
    - ne pas recommencer une recherche ou une découverte déjà faite ;
    - ne pas présenter de nouveau les personnages ;
    - utiliser un titre différent de ceux déjà pris.
- **Résumé** : il doit maintenant décrire la situation exacte à la fin (le suspense laissé pour demain).
- **Côté client** ([generationPlan.ts](../src/utils/generationPlan.ts), [useStoryGeneration.ts](../src/hooks/useStoryGeneration.ts)) : le contexte de la semaine (plan, jours écrits, dernière scène) est gardé pendant la boucle et envoyé à chaque jour (`buildDayParams`).
- **Paragraphes** : une histoire écrite en un seul bloc est découpée (`splitLongParagraph`).
- **Log IA** : l'entrée `Story-Parsed` indique le contexte reçu (plan, nombre de jours précédents, fin d'hier) et le plan renvoyé.

## Vérification
- Typecheck : OK. Client : **81/81**. Serveur : **178/178**. `vite build` : OK.
- **À faire** : régénérer une semaine, puis vérifier dans `ai-<date>.log` :
  - la réponse du lundi contient `week_plan` ;
  - chaque histoire commence par la suite directe de la scène finale de la veille ;
  - les titres sont tous différents.

## Audit 6 bis : seconde correction (semaines « Papouin »)

*7 octobre 2026. Semaines « Le sable », Papouin, 4-6 et 7-9 ans, générées à 23:33 avec Gemini 3.5 Flash Lite.*

**Ce qui marchait** :
- les 14 histoires sont enregistrées ;
- le plan de la semaine est produit et suivi (sable sec → eau → dosage → château → concours) ;
- chaque jour reçoit le contexte (de 0 à 6 jours précédents).

**Nouveaux défauts.** La consigne « reprenez exactement là où s'arrête la fin d'hier (mot pour mot) » était trop forte :
- **le premier paragraphe recopiait la fin de la veille**, 10 fois sur 12 ;
- on ne changeait plus de jour (mercredi commençait le mardi soir) ;
- des histoires s'ouvraient sur « Il… », sans nommer Papouin ;
- Papouin changeait d'apparence chaque jour (cheveux blonds, bouclés, ébouriffés ; 7 ou 8 ans ; short bleu, rayé ou beige) ;
- les histoires étaient courtes : 153 à 255 mots pour une cible de 300 à 450.

**Corrections.**
- **Consigne** ([prompt.helper.js](../server/services/helpers/prompt.helper.js)) :
  - la fin d'hier est donnée « pour mémoire, à ne pas recopier » ;
  - chaque histoire se passe un nouveau jour ;
  - elle s'ouvre sur un court rappel, avec ses propres mots, en nommant le personnage principal, puis répond au suspense ;
  - « Ne recopiez aucune phrase des histoires précédentes ».
- **Garde-fou** : `removeRepeatedOpening` ([story_output.helper.js](../server/services/helpers/story_output.helper.js)) retire les phrases de la fin d'hier recopiées en tête de l'histoire. Le nombre retiré est noté dans le log `Story-Parsed`. Rejoué sur les 14 histoires réelles, il nettoie les 10 reprises sans toucher aux autres.
- **Fiche des personnages** : le lundi renvoie `characters` (nom, âge, apparence, vêtements, caractère).
  - Les jours suivants la reçoivent dans le texte et les illustrations (« décrivez les personnages exactement comme dans la fiche »).
  - Elle est obligatoire dans le schéma avec le plan, et lue par `extractWeekContext`.
- **Longueur** :
  - « au moins N mots » dans la consigne ;
  - `minItems` sur les paragraphes selon l'âge, dans le schéma JSON (`PromptHelper.getTargetParagraphs`) ;
  - le lundi ne doit pas dévoiler les découvertes des jours suivants.
- **Console** : plus de « undefinedms ».

**Vérification** :
- Typecheck : OK. Client : **81/81**. Serveur : **187/187**. `vite build` : OK.
- À faire : régénérer la semaine Papouin et relire les débuts et fins, ainsi que les illustrations.

## Audit 6 ter : finitions (semaines « Marouin »)

*7 octobre 2026. Semaine 30, Marouin, 4-6 et 10-12 ans, générée à 23:43 avec Gemini 3.5 Flash Lite.*

**Réglé et vérifié dans les logs** :
- chaque jour s'ouvre sur un rappel qui nomme Marouin et reprend le suspense de la veille ;
- aucune phrase recopiée (`repeatedOpeningRemoved = 0`) ;
- la fiche des personnages est suivie dans les 7 illustrations ;
- les titres sont tous différents.

**Défauts restants et corrections** :

| Défaut | Correction |
|---|---|
| 10-12 ans : chaque suspense inventait un mystère hors du plan (parchemin, capsule, mécanisme, symbole, lueur), jamais résolu. | Chaque jour reçoit l'étape de **demain**, et le suspense doit la préparer, sans mystère hors du plan. Le **vendredi** résout tous les mystères ouverts ; le week-end n'en rouvre aucun (`getMysteryRule`). |
| Semaine 30 (fin juillet) racontée « un lundi de printemps ». | Le client envoie `weekNumber`. `getWeekPeriod` donne « fin juillet, en été » (jeudi de la semaine ISO), placé dans PARAMÈTRES. |
| 10-12 ans : 211 mots le jeudi (cible 700 à 900). | Si une histoire fait moins de 60 % du minimum de l'âge, une seconde demande est faite avec « Votre précédente version faisait N mots… » (`lengthHint`), et la plus longue est gardée. Le log note `lengthRetry: { before, after }`. |
| Anglicismes (« puddles », « splash »). | Instruction système : uniquement des mots français, prénoms à la française. |

**Vérification** :
- Typecheck : OK. Client : **81/81**. Serveur : **193/193**. `vite build` : OK.
- À faire : régénérer la semaine 30 en 10-12 ans, puis vérifier que :
  - les suspenses mènent à l'étape suivante et le vendredi referme tout ;
  - l'histoire se passe en été ;
  - les histoires font environ 700 mots ;
  - aucun mot anglais n'apparaît.

## Audit 6 quater : paragraphes de remplissage (semaine « Noulopi »)

*7 octobre 2026. Noulopi, 13-15 ans, générée à 23:53.*

**Ce qui marche** :
- la saison (« mi-septembre ») ;
- la continuité et la fiche du personnage ;
- la relance de longueur (vendredi : de 485 à 845 mots).

**Défauts, causés par le `minItems` ajouté à l'audit 6 bis.** Obligé de produire au moins 8 paragraphes, le modèle a rempli :
- le dimanche se terminait par trois commentaires sur le texte (« Un paragraphe de transition pour atteindre la longueur minimale requise… ») ;
- le jeudi se terminait par sa description d'illustration.

Ces lignes comptaient comme des mots, si bien que la relance ne se déclenchait pas.

**Corrections.**
- `minItems` n'est plus envoyé : l'option reste dans `buildSchema`, mais elle n'est pas utilisée pour les histoires.
- `cleanStoryParagraphs` ([story_output.helper.js](../server/services/helpers/story_output.helper.js)), appliqué par `parseStoryOutput`, retire :
  - les paragraphes courts qui parlent du texte lui-même ;
  - la description d'illustration recopiée.

  Il ne vide jamais une histoire. Le nombre retiré est noté dans `Story-Parsed` (`cleanedParagraphs`), et les mots sont comptés après nettoyage.
- Consigne : `paragraphs` ne contient que le texte de l'histoire.
- Rejoué sur les 43 histoires générées le 7 octobre : seuls ces 4 paragraphes sont retirés.

**Vérification** :
- Typecheck : OK. Client : **81/81**. Serveur : **198/198**. `vite build` : OK.
- Les histoires déjà enregistrées (jeudi et dimanche de Noulopi) gardent ces paragraphes : il faut les supprimer ou les régénérer.

## Audit 6 quinquies : longueur des grands et débuts répétitifs (« Claudine et Wikotine »)

*8 octobre 2026. 16-18 ans, deux personnages, « la digestion après les fêtes », Gemini 3.5 Flash Lite.*

**Ce qui marche** :
- deux personnages présents chaque jour, avec la même apparence ;
- le plan suivi jour après jour (salive, estomac, foie et pancréas, intestin, bouillon en famille, bilan) ;
- chaque fin annonce l'étape du lendemain, et le vendredi conclut avec l'activité du week-end ;
- saison juste, aucune recopie, aucun remplissage.

**Défauts et corrections** :

| Défaut | Correction |
|---|---|
| De 609 à 724 mots pour une cible de 1000 à 1200 : Flash Lite plafonne vers 700 mots, au-dessus du seuil de relance (60 %). | **Décision de l'utilisateur** : pour 13-15 et 16-18 ans, les modèles Flash passent en premier (`modelsForAge` dans [gemini.service.js](../server/services/gemini.service.js)), Flash Lite en secours. Les autres âges gardent l'ordre configuré. |
| Débuts répétitifs : « Alors que [neige, givre, tempête]…, Claudine ajusta ses lunettes rondes… » presque chaque jour. | La première phrase de chaque jour (`storyOpening`, [generationPlan.ts](../src/utils/generationPlan.ts)) est montrée aux jours suivants dans « DÉBUTS DÉJÀ UTILISÉS (ne pas imiter) ». Consignes : ouvrir sur une scène nouvelle, puis glisser le rappel de la veille ; ne pas répéter les mêmes gestes ou tics descriptifs. |

**Vérification** :
- Typecheck : OK. Client : **82/82**. Serveur : **200/200**. `vite build` : OK.
- À faire : régénérer en 16-18 ans, puis vérifier dans le log :
  - le modèle est un Flash, et les histoires font environ 1000 mots ;
  - les débuts sont variés.

---

# Audit 7 : semaine en un seul appel pour les petits

*8 octobre 2026. Question de l'utilisateur : peut-on générer une semaine en un seul prompt au lieu de 7, sans faire exploser les quotas gratuits ?*

**Réponse.** Un seul appel consomme **moins** de quota : 1 requête au lieu de 7. Flash Lite permet 500 requêtes par jour : environ 500 semaines par jour en un appel, contre environ 70 en jour par jour. Les tokens d'entrée et les pauses de 12 s sont aussi réduits.

Le jour par jour avait été adopté pour la **qualité** (audit 5) :
- en un appel, le modèle comprime les histoires longues (13-15 ans : 457 à 672 mots pour une cible de 900 à 1100) ;
- une grosse réponse risque de dépasser le délai ;
- un échec fait perdre toute la semaine.

Pour les petits âges, une semaine reste courte (environ 2 500 mots en 4-6 ans).

**Décision de l'utilisateur** :
- **un seul appel** pour 2-3, 4-6 et 7-9 ans ;
- **jour par jour** à partir de 10-12 ans ;
- **Ollama** toujours en jour par jour.

**Changements.**
- **Client** :
  - `isIterativeGeneration(dayOfWeek, age, provider)` ([generationPlan.ts](../src/utils/generationPlan.ts)) ;
  - la décision est prise par âge dans la boucle ([useStoryGeneration.ts](../src/hooks/useStoryGeneration.ts)), et la progression compte 1 ou 7 unités par âge.
- **Prompt en mode semaine** ([prompt.helper.js](../server/services/helpers/prompt.helper.js)). Les consignes qui ont fait leurs preuves en jour par jour :
  - une seule aventure, avec des personnages identiques (texte et illustrations) ;
  - chaque histoire se comprend seule : une scène nouvelle, puis le rappel de la veille en nommant le personnage principal ;
  - 7 débuts différents, aucune phrase recopiée, aucun tic répété ;
  - le suspense du lundi au jeudi mène au lendemain, le vendredi résout tout, le week-end n'ouvre rien ;
  - « au moins N mots pour chacune des 7 histoires ».
- **Serveur** :
  - délai de 240 s pour un appel « semaine » (`GEMINI_WEEK_TIMEOUT_MS`) ;
  - `removeRepeatedOpening` appliqué entre les jours d'une même réponse ;
  - relance de longueur sur la **médiane** des 7 histoires (sous 60 % du minimum), une seule fois.

**Vérification** :
- Typecheck : OK. Client : **82/82**. Serveur : **204/204**. `vite build` : OK.
- À faire : générer une semaine en 4-6 ans (une seule entrée `Story` avec 7 histoires dans le log) et une en 10-12 ans (7 entrées), puis relire la continuité et la longueur.

## Audit 7 bis : première semaine en un seul appel (« Les châtaignes », 4-6 ans)

*8 octobre 2026. Léonie et Antonin, Gemini 3.5 Flash Lite.*

**Résultat** : 1 requête, 23 s, de 267 à 337 mots par histoire, contre 204 à 323 en jour par jour (Jimini).
- La continuité tient : bogue → ouverture → écureuil voleur → panier trop lourd → festin.
- La saison est juste (mi-octobre), et le vendredi conclut avec l'activité du week-end.
- Aucune relance ni nettoyage nécessaire.

**Défauts et corrections** :

| Défaut | Correction |
|---|---|
| Du mardi au dimanche, les 6 histoires s'ouvrent sur « Hier, Léonie et Antonin avaient… Aujourd'hui, … ». | Consigne dans les deux modes : la première phrase est une action ou un dialogue du jour, jamais « Hier », « La veille », « Après avoir » ni « Alors que » (`FORBIDDEN_OPENINGS`). Le log `Story-Parsed` compte ces débuts et les débuts identiques (`repetitiveOpenings`). |
| Dialogues sans guillemets. | Instruction système : dialogues entre guillemets français, tiret à chaque changement d'interlocuteur. |
| « les bogues et les bogues et les branches ». | `removeStutter` retire un groupe de 2 à 4 mots écrit deux fois de suite (8 caractères au moins : « très très » reste). Rejoué sur 407 paragraphes réels, il ne corrige que ce cas. |

**Vérification** :
- Typecheck : OK. Client : **82/82**. Serveur : **211/211**. `vite build` : OK.
- À faire : régénérer la semaine. `repetitiveOpenings` doit être proche de 0, et les dialogues entre guillemets.

## Audit 7 ter : semaine incomplète (« Halloween », 4-6 ans)

*8 octobre 2026. Semaine 43, Sweety, « Toute la semaine » : **1 histoire créée au lieu de 7**, sans erreur visible.*

**Causes** (`ai-2026-10-08.log`, 22:03) :
1. La première réponse ne contenait qu'**une** histoire (le lundi, 167 mots) : le schéma n'imposait pas 7 histoires.
2. **Bug de la relance (audit 7)** : la relance est partie (167 mots, sous 60 % de 300) et a renvoyé les **7 histoires**. Mais deux réponses n'étaient comparées que si elles avaient le même nombre d'histoires (1 contre 7) : la relance a été écartée, et la réponse à une histoire gardée.
3. Dans la relance, le jeudi était étiqueté « Mardi ».

**Corrections** :
- **Schéma** : `storyCount` impose exactement 7 histoires (`minItems` et `maxItems` sur `stories`) pour un appel « semaine », avec Gemini comme avec Ollama.
- **Relance** ([story.service.js](../server/services/story.service.js)) :
  - une semaine de moins de 7 histoires est relancée, avec « Votre réponse ne contenait que N histoire(s) : écrivez les 7 histoires… » ;
  - `isBetterAnswer` garde la réponse la plus **complète**, puis la plus longue ;
  - le log note `incomplete` si la semaine reste incomplète.
- **Jours** : `assignWeekDays` attribue Lundi…Dimanche dans l'ordre quand les 7 jours ne sont pas distincts, et retire les doublons d'une réponse incomplète. Le log note `daysFixed`.
- **Client** : « ⚠️ Semaine incomplète : N histoire(s) sur 7 » dans le journal, et les histoires manquantes sont comptées comme des échecs dans le rapport.

**Vérification** :
- Typecheck : OK. Client : **83/83**. Serveur : **217/217**. `vite build` : OK.
- À faire : régénérer la semaine 43 et vérifier qu'on obtient 7 histoires. L'histoire « Le costume magique de Sweety » déjà créée reste seule : il faut la supprimer, ou régénérer la semaine.

---

# Audit 8 : export PDF

*8 octobre 2026.*

**Fonctionnement.** « Mes histoires » → « Exporter en PDF » :
- on choisit les histoires et les options : illustrations, couverture, sommaire, police, taille, format, orientation ;
- `POST /api/export/pdf` construit le livre avec jsPDF ([server/lib/pdf](../server/lib/pdf)).

**Problèmes trouvés** :

| Problème | Effet |
|---|---|
| Le client demandait un fichier (`responseType: 'blob'`), le serveur répondait en JSON (`{ url }`). | L'export échouait à chaque fois (« Réponse invalide du serveur »). |
| La traduction serveur cherchait les clés à plat (`"pdf.tocTitle"`) dans des fichiers imbriqués, et 3 clés n'existaient pas. | Le PDF affichait « pdf.tocTitle », « story.themes: … ». |
| Le contenu des histoires était écrit tel quel. | Les balises `<p>` des histoires générées apparaissaient, sans séparation des paragraphes. |
| La page d'histoire imposait Helvetica 14 pt. | Les options police et taille étaient sans effet. |
| PDF renvoyé encodé dans du JSON (data URI), ouvert avec `window.open`. | Réponse lourde, et ouverture bloquée par les navigateurs. |
| Le sommaire était écrit après coup, sans couper les titres. | Titres longs débordants ; numéros de page faux si le sommaire dépassait une page. |
| Aucun ordre ni repère. | Histoires dans un ordre arbitraire, sans semaine ni jour, sans numéros de page. |
| Images. | Le format WebP n'était géré que pour la première illustration. |

**Corrections** :
- **Réponse binaire** : `application/pdf` en pièce jointe ([index.js](../server/lib/pdf/index.js)). Le client crée une URL locale et un lien de téléchargement ([PDFExport.tsx](../src/components/Common/PDFExport.tsx)). Les erreurs reçues sous forme de Blob sont relues pour afficher le vrai message ([client.ts](../src/api/client.ts)).
- **Traductions** : clés imbriquées lues dans [i18n.js](../server/lib/i18n.js), dossier des langues trouvé depuis le module (et non le dossier courant). Nouvelles clés `pdf.illustrationFor`, `storiesCount`, `generatedOn`, `pageNumber`, `tags`, `ageGroup` et `weekDay`.
- **Texte** ([storyText.js](../server/lib/pdf/helpers/storyText.js)) :
  - HTML ou texte converti en paragraphes ;
  - caractères codés traduits, gras et mentions `[Illustration]` retirés ;
  - caractères absents des polices standard retirés (emojis) ;
  - espaces insécables avant ; : ! ? et à l'intérieur des guillemets « ».
- **Typographie** ([fonts.js](../server/lib/pdf/fonts.js)) : police (Helvetica, Times, Courier) et taille (12, 14 ou 16 pt) appliquées au texte, avec un interligne de 1,5 et un espace entre les paragraphes.
- **Livre** ([generate.js](../server/lib/pdf/generate.js)) :
  - ordre semaine → âge → jour ;
  - page de titre : titre sur plusieurs lignes, « Semaine N · Jour », âge, étiquettes, illustration principale ;
  - sommaire sur des pages réservées à l'avance, titres tronqués avec « … » ;
  - numéros de page « n / total » en bas, sauf sur la couverture ;
  - `loadImage` partagé, WebP compris ;
  - messages de débogage retirés.
- **Rendu vérifié** sur un PDF d'essai, converti en images : couverture, sommaire, titre long sur trois lignes, paragraphes, accents, guillemets.

**Vérification** :
- Typecheck : OK. Client : **87/87**. Serveur : **227/227** (nouveau `pdf.layout.test.js`). `vite build` : OK.
- À faire : un export réel depuis l'application, avec des illustrations.

## Audit 8 bis : styles du PDF

*8 octobre 2026. Demande : pouvoir choisir un style enfantin pour les petits, un style ado ou un style plus professionnel.*

**Décisions de l'utilisateur** :
- polices libres embarquées (licence SIL OFL, `server/assets/fonts`, chacune avec son `OFL.txt`) ;
- choix « Automatique » par défaut selon l'âge, ou style forcé.

| | Enfantin | Ado | Pro |
|---|---|---|---|
| Police | Andika (conçue pour l'apprentissage de la lecture) | Poppins | Crimson Text |
| Corps (petit / moyen / grand) | 16 / 18 / 20 pt | 12 / 13 / 14 pt | 11 / 12 / 13 pt |
| Titre | bandeau arrondi pastel, étoiles | « JOUR 1 · LUNDI » + barre turquoise | centré, filet bordeaux, métadonnées en italique |
| Texte | à gauche, interligne 1,7 | à gauche, interligne 1,5 | justifié, retrait, interligne 1,4 |
| Page | cadre arrondi, numéro dans une pastille | bande turquoise, « — 3 — » | en-tête courant et filet, numéro centré |
| Couverture | fond pastel, ronds et étoiles | aplat bleu nuit | sobre, filet |

**Fonctionnement** :
- `resolveTheme` ([themes.js](../server/lib/pdf/themes.js)) : en Automatique, Enfantin si une histoire est pour les 2-6 ans, sinon Ado. La même règle existe côté client (`resolvePdfStyle`) pour afficher le style retenu.
- `registerThemeFonts` ([fontRegistry.js](../server/lib/pdf/fontRegistry.js)) charge les TTF une seule fois, et se replie sur Helvetica ou Times si un fichier manque.
- Les cadres, en-têtes courants et numéros de page sont dessinés une fois toutes les pages créées (`decoratePage`).

**Mise en page commune** :
- **Plus de page de titre vide** : sans illustration, le titre est en haut de la première page de texte (l'export du 8 octobre aurait 9 pages de moins).
- **Contrôle des orphelines** (`chooseLayout`) : une dernière page de 1 ou 2 lignes est évitée en resserrant l'interligne de 10 % au plus.
- L'option « police » du formulaire est remplacée par « Style » ; la taille reste réglable.

**Rendu vérifié** : trois PDF d'essai avec de vraies histoires (Léonie et Antonin, Marouin), convertis en images. Le PDF Enfantin pèse 443 Ko, car seuls les caractères utilisés sont embarqués.

**Vérification** :
- Typecheck : OK. Client : **88/88**. Serveur : **233/233**. `vite build` : OK.
- À faire : exporter les mêmes histoires dans chaque style depuis l'application, avec des illustrations.

## Audit 9 : atelier d'illustrations

**Problème** : beaucoup d'histoires n'ont pas d'image. Le prompt d'illustration existe (`stories.illustration_prompt`), mais il fallait, pour chaque histoire : l'ouvrir, copier le prompt, générer l'image ailleurs, la télécharger, ouvrir l'édition, choisir le fichier.

**Contrainte** : tous les modèles d'image de l'API Gemini (Nano Banana, 2, Pro, Lite) sont à 0/0 en gratuit. L'appli ne peut pas générer les images elle-même.

**Décisions** : images faites dans des outils web gratuits ; prompts manquants créés par IA.

**Serveur**
- [image_prompt.helper.js](../server/services/helpers/image_prompt.helper.js) : `imageCode` (`IMG-` + 8 premiers caractères de l'id), `buildImagePrompt` (style selon l'âge + description + « format 4:3, aucun texte »), textes d'export `.txt` (groupés par semaine) et `.json` (outil Canvas).
- [illustration.service.js](../server/services/illustration.service.js) et `/api/illustrations` :
  - `GET /todo` : histoires sans image (filtre `hasImage` existant), dans l'ordre du livre ;
  - `GET /export?format=txt|json` ;
  - `POST /:storyId/prompt` : description écrite par l'IA (`geminiService.generateText`, mêmes modèles et replis que les histoires ; Ollama sans clé Gemini), enregistrée sans nouvelle version ;
  - `PUT /:storyId/prompt` : correction manuelle.
- Les images passent par l'upload existant (`POST /api/upload` avec `storyId`).

**Client** : page [Illustrations](../src/pages/IllustrationsPage.tsx), lien dans l'en-tête.
- Une ligne par histoire : prompt modifiable, « Copier le prompt », « Créer le prompt », zone image (clic puis Ctrl+V, glisser-déposer, fichier). Les images de plus de 4,5 Mo sont réduites avant l'envoi.
- « Créer les prompts manquants » : un appel toutes les 5 s (quota Flash Lite), avec arrêt possible.
- Import en lot ([illustrationImport.ts](../src/utils/illustrationImport.ts)) : images ou ZIP (`fflate`) ; rattachement par code dans le nom, sinon par ordre de téléchargement vers les histoires sans image ; chaque rattachement est modifiable avant l'envoi.
- Fiche d'une histoire sans image : « Créer le prompt » et « Ajouter l'image ».

**Outil Gemini Canvas** : [canvas-illustrations.html](../public/tools/canvas-illustrations.html), version remise à jour de l'ancien générateur par lots de l'utilisateur.
- L'ancien outil ne fonctionnait plus : Imagen 3 seul, prompts lus dans un dump SQL à l'ancien format, images nommées `image_N_…`.
- Le nouvel outil lit le JSON exporté, essaie Gemini 2.5 Flash Image puis Imagen 4 (modèle suivant si refusé, attente sur 429), peut donner l'image précédente de la semaine en modèle pour garder les personnages, et télécharge un ZIP d'images nommées par code.
- Il ne marche que dans Canvas (clé vide fournie par Google) : à confirmer par un essai réel.

**Vérification**
- Typecheck : OK. Client : **95/95**. Serveur : **242/242**. `vite build` : OK.
- API réelle : 28 histoires sans image, toutes avec un prompt ; exports `.txt` et `.json` corrects.
- À faire : coller une image sur une ligne, importer un lot sans renommer, essayer l'outil dans Gemini Canvas, vérifier les images sur les cartes et dans le PDF.
