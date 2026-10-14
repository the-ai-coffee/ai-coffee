# Quiz brise-glace UX v2 — design

- **Date** : 2026-10-14
- **Statut** : proposé (à valider avant le plan d'implémentation)
- **Base** : module V1 livré par la PR #8 (`docs/superpowers/specs/2026-10-13-quiz-brise-glace-design.md`, mode d'emploi `docs/quiz.md`)
- **Branche** : `feat/quiz-ux-v2`

## 0. Intention

Rendre le quiz plus fluide et plus « jeu » sans toucher à son cœur pédagogique (score de calibration, révélation collective) :

1. écran animateur plus fluide et plus lisible ;
2. téléphone joueur au style « Plateau TV » ;
3. timer par question et chrono global ;
4. énoncés explicites ;
5. résultat vrai/faux fortement mis en évidence ;
6. médias de *Humain ou IA ?* fournis par simple URL (image ou vidéo).

### Décisions validées

| Sujet | Décision |
|---|---|
| Timer | **Par question** sur le téléphone + **chrono global** sur l'écran animateur. Aucun effet sur le score. |
| Durées | Défaut par jeu, surchargeable par question (`timeLimit`) ; chrono global calculé. |
| Médias | `media.url` : YouTube/Vimeo (liens complets) et URL directes d'images/vidéos. Pas de réseaux sociaux. |
| Style joueur | « Plateau TV » (dégradé violet → orange, gros boutons en relief, confettis), **cantonné au téléphone en jeu**. |
| Moment du vrai/faux | **Hybride** : pendant le jeu, flash neutre « Réponse enregistrée ✓ » ; vrai/faux en flash plein écran **à la révélation**, synchronisé avec l'animateur. |
| Écran animateur | « Régie » : tout sur un écran, clavier, réaction immédiate, colonne des joueurs avec **avatars emoji**. |
| Énoncés | Consigne fixe et explicite par jeu + boutons en phrases complètes + champ optionnel `question`. |

### Hors périmètre

Bonus de rapidité, embeds TikTok/Instagram/X, copie locale des médias, carte « Comment jouer », jeu C (*Atelier de prompts*).

---

## 1. Règles du jeu, timer et serveur

### 1.1 Timer par question (téléphone)

| Jeu | Durée par défaut |
|---|---|
| `human_or_ai` | 15 s |
| `bet_machine` | 20 s |
| `investigation` | 30 s |
| `prompt_duel` | 30 s |

- `timeLimit` (entier, 5–120 s) dans une question remplace la valeur par défaut.
- **Vidéo** : le compte à rebours démarre à la fin de l'extrait (événement `ended` pour une vidéo directe, ou `end − start` secondes pour un embed) ; durée inconnue → départ immédiat.
- Le timer couvre **choix + confiance** :
  - à 0 **sans choix** → question passée, non répondue (aucun envoi) ;
  - à 0 **après le choix** → envoi avec confiance `1` (« Je pense »).
- Score inchangé. Timer côté client : un rechargement relance la question en cours depuis le début (pas d'enjeu de score, pas d'anti-triche).

### 1.2 Chrono global (animateur)

- `durationSec` = somme des `timeLimit` effectifs (défauts compris) + 60 s, arrondie à la minute supérieure.
- Démarre à **Ouvrir la partie** : l'état stocke `openedAt` (ISO) et `durationSec` ; un rechargement de l'écran animateur reprend le décompte.
- Action `extend {deltaSec}` (±60) ajuste `durationSec` (minimum 60 s).
- À 0 : chrono rouge, bouton **Révéler** qui pulse. **Pas** de révélation automatique.

### 1.3 Changements serveur (limités)

- `state` : `{ status, revealIndex, openedAt?, durationSec? }` — `open` renseigne `openedAt` (horloge serveur) et `durationSec` (calculé depuis la partie).
- `POST host {action: "extend", deltaSec}` : uniquement en `open`, `deltaSec ∈ {-60, 60}`, sinon 400 `invalid_delta`.
- `POST join {pseudo, uid?, avatar?}` : `avatar` doit appartenir à la liste fermée `AVATARS` (module partagé `quiz/lib/avatars.js`) ; absent ou invalide → avatar tiré côté serveur. Stocké dans le blob joueur, renvoyé par `join` et par `host-state` (`players[].avatar`).
- Inchangés : scoring, profils, `me` (ajoute seulement `avatar`), export, historique, stockage des réponses (un blob par réponse).

### 1.4 Révélation synchronisée sur les téléphones

- Le polling joueur passe à **1,5 s** en `reveal`/`done` (3 s sinon).
- À chaque nouvelle question révélée (`revealIndex` change), le téléphone joue un **flash plein écran** ~1,2 s : **BRAVO ! 🎉** (confettis) / **RATÉ 😬** / **PAS RÉPONDU ⏱** / **TROP TARD** (réponse arrivée après la révélation), puis la carte de détail.
- Spectateurs (sans pid) : pas de flash, carte de détail directement.

---

## 2. Téléphone joueur — style « Plateau TV »

### 2.1 Thème

- Nouveau `quiz/game.css`, chargé **uniquement** par `quiz/index.html`, après `quiz.css`. Variables propres au thème (`--game-*`), sans redéclarer les tokens de `design/tokens.css`.
- Dégradé violet → orange, gros boutons arrondis en relief (≥ 56 px de haut), typo grasse (Geist 800), titres Instrument Serif possibles.
- `DESIGN.md` documente l'exception : « le téléphone joueur pendant le quiz a son propre thème ludique ; tout autre support reste dans la charte ».
- Animations désactivées/raccourcies sous `prefers-reduced-motion`. Contraste AA vérifié sur le dégradé. Le résultat n'est **jamais** porté par la seule couleur (icône + texte).

### 2.2 Parcours

1. **Rejoindre** : grand avatar emoji + pseudo préremplis ; 🎲 relance les deux ; tap sur l'avatar → avatar suivant ; **Jouer**.
2. **Attente** : « La partie va commencer… » + avatar animé.
3. **Question** : barre/anneau de temps (rouge < 5 s) · `3/8` · série de participation 🔥 ; **consigne** (§4.2) ; `question` optionnelle ; média ; gros boutons-réponses en phrases. Après le choix : trois gros boutons de confiance, sous le même timer.
4. **Flash « Réponse enregistrée ✓ »** (~0,8 s) puis question suivante. Indicateur « non envoyée » conservé.
5. **Fin** : « C'est dans la boîte ☕ » + « 7/8 répondues ».
6. **Révélation** : flash (§1.4) puis carte : bonne réponse surlignée, ta réponse marquée (✅/❌), concept + explication, mention « Trop tard » si besoin.
7. **Profil** : avatar, profil IA, score animé (compteur), badges, progression.

---

## 3. Écran animateur — « Régie »

Reste dans la charte AI Coffee (crème, espresso, rust), 16:9.

### 3.1 Disposition

- **Bandeau** : statut · titre · contrôles (Ouvrir / Révéler / ◀ ▶ / Terminer / ±1 min / Réinitialiser).
- **Zone principale** (gauche) selon l'état.
- **Colonne des joueurs** (droite) : avatar, pseudo, progression `n/8`, pastille ✓ quand fini ; ordre d'arrivée ; mise à jour **sur place** (pas de reconstruction).

### 3.2 Fluidité

- **Optimiste** : ◀ ▶ Révéler mettent à jour l'écran immédiatement, la requête suit ; rollback + message en cas d'erreur. Les gardes existantes (séquence de polling, action en cours) sont conservées.
- **Clavier** : `→` suivant · `←` précédent · `Espace` révéler (puis suivant) · `F` plein écran. Ignoré quand le focus est dans un champ.
- **Polling 1 s**. Zone principale redessinée seulement au changement `status:revealIndex` ; colonne joueurs et compteurs mis à jour en place.
- **Animations** : barres qui se remplissent, bonne réponse dévoilée après ~1 s de suspense, chiffre du niveau du jour qui monte.

### 3.3 États

- **En jeu** : grand chrono global (±1 min, rouge à 0), QR + URL visibles en permanence, « connectés · ont fini · % de réponses ».
- **Révélation** : consigne + média en grand, barres animées, bonne réponse en vert, « X % ont trouvé », concept + explication.
- **Niveau du jour** : score qui monte, concepts du plus faible au plus fort avec comparaison à la session précédente, répartition des profils avec avatars.

---

## 4. Contenu, médias, outillage

### 4.1 Médias par URL

- Forme courte : `"media": { "url": "https://…", "alt"?: "…", "start"?: n, "end"?: n, "fallback"?: "https://…" }`.
- `resolveMedia(media) -> {kind, provider?, id?, src?, start?, end?, alt?, fallback?} | {error}` (fonction pure partagée, `quiz/lib/media-url.js`) :
  - `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/shorts/ID` → `video/youtube`, `t=`/`start=` (secondes ou `1m30s`) → `start` ;
  - `vimeo.com/ID` → `video/vimeo` ;
  - `.jpg .jpeg .png .webp .gif .avif` → `image` (`alt` obligatoire) ;
  - `.mp4 .webm .mov` → `video` directe ;
  - `start`/`end` explicites priment sur l'URL ;
  - refus : non `https`, TikTok/Instagram/X/Facebook (message explicite), extension/domaine inconnus.
- L'ancienne forme (`kind`, `provider`, `id`, `src`) reste valide.
- Liste blanche des sous-champs de `media` avant révélation : ajout de `url`.

### 4.2 Consignes

| Jeu | Consigne | Boutons |
|---|---|---|
| `human_or_ai` | « Ce contenu a-t-il été créé par un humain ou par une IA ? » | « 🧑 Un humain » · « 🤖 Une IA » |
| `bet_machine` | « On a posé cette question à une IA. Que va-t-elle répondre ? » | textes des `choices` |
| `investigation` | « Quelle réponse de l'IA pose problème ? » | bulles IA + « 🤷 Tout est correct » |
| `prompt_duel` | « Lequel de ces prompts donnera le meilleur résultat ? » | « Prompt A / B / C » + texte |

- Champ optionnel `question` (≤ 300 caractères) affiché sous la consigne, en plus.

### 4.3 Validateur, skill, docs

- Validateur : `timeLimit` (entier 5–120), `question` (texte ≤ 300), `media.url` via `resolveMedia`.
- Skill `/quiz` : propose des `media.url`, ne pose `timeLimit` que si le défaut ne convient pas, rédige `question` quand la consigne fixe ne suffit pas ; rappels « URL neutre » et `verify: true` maintenus.
- `docs/quiz.md` : URL de médias, timer et chrono, raccourcis clavier, avatars. `DESIGN.md` : exception de thème.
- Partie `demo` : une image et une vidéo par URL (`verify: true`), un `timeLimit` d'exemple.

---

## 5. Tests

- **Unitaires (`node:test`)** : `resolveMedia` (chaque forme, `t=`, Shorts, extensions, refus) ; validateur (`timeLimit`, `question`, `url`) ; API (`avatar` à `join` et dans `host-state`, `openedAt`/`durationSec` à `open`, `extend` bornes et statut) ; calcul de `durationSec` ; avatars (liste fermée).
- **Navigateur headless (Chromium/Playwright, hors repo)** : expiration du timer avec et sans choix ; flash de révélation BRAVO / RATÉ / PAS RÉPONDU ; raccourcis clavier et réaction immédiate de la Régie ; colonne joueurs avec avatars ; captures téléphone 390×844 et écran 1920×1080.
- **Répétition humaine** : vrais téléphones (iOS Safari, Android Chrome), vidéo YouTube avec timer, durée totale ≤ 12 min.

## 6. Risques

| Risque | Parade |
|---|---|
| Thème « Plateau TV » peu lisible | Contraste AA vérifié, texte + icône, `prefers-reduced-motion` |
| Timer trop court pour un débutant | Défauts par jeu généreux, `timeLimit` par question, confiance auto « Je pense » |
| Embed vidéo bloqué / lent | `fallback`, timer qui attend la fin de l'extrait, vérification la veille |
| Réaction optimiste incohérente avec le serveur | Rollback sur erreur + gardes de séquence existantes |
| Désynchronisation téléphone / écran partagé | Polling 1,5 s en révélation, flash déclenché sur changement de `revealIndex` |
