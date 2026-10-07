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
