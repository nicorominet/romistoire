# Contributing to Romistoire

**[English]**  
Thank you for your interest in contributing to Romistoire! Here is how you can help.

## 🐛 Reporting Bugs
1. Go to the **Issues** tab on GitHub.
2. Click **New Issue**.
3. Describe the bug clearly (what happened, what you expected, steps to reproduce).

## 💡 Suggesting Features
1. Go to the **Issues** tab.
2. detailed your idea and why it would be useful.

## 💻 Contributing Code
1. **Fork** the repository (click the "Fork" button at the top right).
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/romistoire.git
   ```
3. Create a new **branch** for your feature:
   ```bash
   git checkout -b feature/my-amazing-feature
   ```
4. **Commit** your changes.
5. **Push** to your fork:
   ```bash
   git push origin feature/my-amazing-feature
   ```
6. Open a **Pull Request** (PR) on the main repository comparing your branch.

## 📐 Coding Standards

### TypeScript
- We enforce **strict typing**. Avoid using `any` unless absolutely necessary.
- Define interfaces for all data structures (API responses, Props) in `src/types`.

### React & State Management
- Use **React Query** for data fetching and caching. Avoid `useEffect` for data loading where possible.
- **Do not use `window.location.reload()`**. Use `queryClient.invalidateQueries()` to refresh data.

### Architecture
- **Constants**: Store all magic strings, storage keys, and API endpoints in `src/constants.ts`.
- **Services**: Business logic should reside in `server/services`, not in controllers.

---

# Contribuer à Romistoire

**[Français]**  
Merci de votre intérêt pour Romistoire ! Voici comment vous pouvez aider.

## 🐛 Signaler des Bugs
1. Allez dans l'onglet **Issues** sur GitHub.
2. Cliquez sur **New Issue**.
3. Décrivez le bug clairement (ce qui s'est passé, ce que vous attendiez, les étapes pour reproduire).

## 💡 Suggérer des Fonctionnalités
1. Allez dans l'onglet **Issues**.
2. Détaillez votre idée et pourquoi elle serait utile.

## 💻 Contribuer au Code
1. **Forkez** le dépôt (cliquez sur le bouton "Fork" en haut à droite).
2. **Clonez** votre fork localement :
   ```bash
   git clone https://github.com/VOTRE_USERNAME/romistoire.git
   ```
3. Créez une nouvelle **branche** pour votre fonctionnalité :
   ```bash
   git checkout -b feature/ma-super-fonctionnalite
   ```
4. **Commitez** vos changements.
5. **Pushez** sur votre fork :
   ```bash
   git push origin feature/ma-super-fonctionnalite
   ```
6. Ouvrez une **Pull Request** (PR) sur le dépôt principal en comparant votre branche.

## 📐 Standards de Code

### TypeScript
- Nous appliquons un **typage strict**. Évitez `any` sauf absolue nécessité.
- Définissez des interfaces pour toutes les structures de données dans `src/types`.

### React & Gestion d'État
- Utilisez **React Query** pour la récupération de données. Évitez `useEffect` pour le chargement de données simple.
- **Ne jamais utiliser `window.location.reload()`**. Utilisez `queryClient.invalidateQueries()` pour rafraîchir.

### Architecture
- **Constantes** : Stockez toutes les chaînes magiques, clés de stockage et endpoints API dans `src/constants.ts`.
- **Services** : La logique métier doit résider dans `server/services`, et non dans les contrôleurs.
