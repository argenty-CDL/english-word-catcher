# Déploiement : Web Component same-origin + intégration Webflow

Ce jeu est livré comme un **Web Component** `<word-catcher>` : un seul fichier JS
autonome (`word-catcher.js`, React et CSS inclus) que tu charges directement dans
ta page Webflow.

## Pourquoi ce choix (et pas un iframe)

- **Same-origin** : le jeu tourne dans le contexte de ta page. GA4 continue de
  compter le temps d'engagement (un iframe cross-origin met ce compteur en pause
  quand le visiteur clique dedans). C'est le gain SEO recherché.
- **Isolation CSS** : le rendu se fait dans un **Shadow DOM**. Le Tailwind du jeu
  ne fuit pas vers ton blog, et le CSS de Webflow ne déforme pas le jeu.
- **Clavier scopé** : flèches et barre d'espace n'agissent que quand le visiteur a
  cliqué dans le jeu — le scroll de l'article n'est jamais détourné.
- **Événements** : le jeu pousse des événements dans `window.dataLayer` (GTM), qui
  les relaie ensuite vers GA4 et HubSpot.

> ⚠️ **Limite connue** : le jeu se contrôle actuellement au **clavier uniquement**
> (flèches + espace). Les visiteurs mobiles ne peuvent pas jouer. À corriger en
> priorité si tu vises l'engagement sur mobile (ajout de contrôles tactiles).

## Application statique — aucune clé API

Malgré la config héritée d'AI Studio (`GEMINI_API_KEY`, dépendance `@google/genai`),
le code n'appelle jamais Gemini. Aucun serveur, aucune clé, aucun secret. GitHub
Pages suffit.

---

## Étape 1 — Créer le dépôt GitHub

1. https://github.com/new
2. Nom : `english-word-catcher`, visibilité **Public** (Pages gratuit l'exige).
3. Ne coche rien (pas de README/.gitignore) — tout est déjà dans le projet.
4. **Create repository**.

## Étape 2 — Envoyer le code

À la racine du projet :

```bash
git init
git add .
git commit -m "chore: initial commit"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/english-word-catcher.git
git push -u origin main
```

## Étape 3 — Activer GitHub Pages

1. **Settings → Pages**.
2. **Build and deployment → Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` compile (`npm run build:embed`) et
   publie `dist-embed/` automatiquement à chaque push.

Suis le build dans l'onglet **Actions** (~1 min). Une fois terminé, tu as :

- La démo jouable : `https://TON-PSEUDO.github.io/english-word-catcher/`
- Le script à charger : `https://TON-PSEUDO.github.io/english-word-catcher/word-catcher.js`

Ouvre la démo pour vérifier. La console affiche les événements `dataLayer` envoyés.

## Étape 4 — Intégrer dans Webflow

1. Webflow Designer → page de blog → glisse un composant **Embed**.
2. Colle (remplace `TON-PSEUDO` par ton pseudo GitHub) :

```html
<word-catcher></word-catcher>
<script src="https://TON-PSEUDO.github.io/english-word-catcher/word-catcher.js" defer></script>
```

3. **Save & Close**, puis **Publish**.

Le composant se dimensionne lui-même : largeur 100 % (plafonnée à 840 px, centrée)
et hauteur adaptée (`clamp(480px, 80vh, 620px)`) pour que tout l'écran d'accueil
tienne sur mobile. **N'ajoute pas** de wrapper avec `aspect-ratio` ou `height`
autour : ça écraserait ce dimensionnement et réintroduirait le cadre trop court.

---

## Étape 5 — Brancher les événements (GTM → GA4 + HubSpot)

Le jeu pousse ces événements dans `window.dataLayer` :

| Événement | Données | Quand |
|---|---|---|
| `word_catcher_game_start` | — | Le visiteur lance une partie |
| `word_catcher_game_over` | `score`, `errors` | Fin de partie |

**Le temps d'engagement / signal SEO ne nécessite aucun câblage** : il est capté
automatiquement par GA4 puisque le jeu est same-origin.

### Côté Google Tag Manager (pour les événements custom)

Pour chaque événement à suivre :

1. **Déclencheurs → Nouveau → Événement personnalisé**.
   Nom de l'événement : `word_catcher_game_over` (exactement).
2. **Variables → Variables définies par l'utilisateur → Variable de couche de données**.
   Crée `dlv.score` (nom : `score`) et `dlv.errors` (nom : `errors`).
3. **Balises → Nouvelle → Google Analytics : événement GA4**.
   - Nom de l'événement : `word_catcher_game_over`
   - Paramètres : `score` = `{{dlv.score}}`, `errors` = `{{dlv.errors}}`
   - Déclencheur : celui créé à l'étape 1.
4. Idem pour `word_catcher_game_start` si tu veux suivre les lancements.
5. **HubSpot** : ajoute une balise HubSpot (ou un événement personnalisé HubSpot)
   sur le même déclencheur, selon ton plan HubSpot.

Sans GTM, les `dataLayer.push` sont inoffensifs (ne cassent rien). Tu peux brancher
le tracking plus tard sans retoucher le code.

---

## Mettre à jour le jeu

```bash
git add .
git commit -m "feat: describe your change"
git push
```

GitHub Actions rebuild et republie ; Webflow sert toujours la dernière version.

## Tester en local

```bash
npm install          # une seule fois
npm run dev          # http://localhost:3000 (version plein écran)
npm run build:embed  # génère dist-embed/word-catcher.js + index.html de démo
npm run lint         # vérification TypeScript
```
