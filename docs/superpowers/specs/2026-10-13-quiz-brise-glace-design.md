# Quiz brise-glace — design

- **Date** : 2026-10-13
- **Statut** : proposé (à valider avant le plan d'implémentation)
- **Cible** : première utilisation en ouverture de la session 05
- **Auteurs** : Michael (co-organisateur), avec Claude

## 0. Intention

Ouvrir chaque session d'AI Coffee par un jeu court, original et « à l'air de l'IA » : les participants scannent un QR code partagé dans le chat Meet, jouent sur leur téléphone, puis l'animateur débriefe en quelques minutes et affiche le **niveau du jour** du groupe en IA.

Au-delà du brise-glace, le module est un **outil de progression** : chaque question est rattachée à un concept des fondamentaux de l'IA (hallucination, tokenisation, prompting…), l'explication est montrée au debrief, et l'historique des résultats oriente le contenu des sessions suivantes (rappels, concepts faibles).

### Contraintes et choix validés

| Sujet | Décision |
|---|---|
| Mécanique | Moteur modulaire de mini-jeux. V1 : *Humain ou IA ?*, *Pariez sur la machine*, *L'Enquête*, *Duel de prompts*. Plus tard (nice to have) : *Atelier de prompts* (C, rédaction libre + LLM-juge). |
| Durée | Jeu + debrief : **8 à 12 min** (cible 10). |
| Rythme | **Hybride** : chacun joue à son rythme, l'animateur déclenche une révélation collective. |
| Identité | **Pseudo** généré par défaut (modifiable) + **profil IA** personnel ; pas de classement nominatif. |
| Contenu | Un **fichier JSON par session** (le contrat), généré par un skill Claude depuis `sessions/NN.md` et l'historique, relu par les organisateurs. |
| Progression | **Collective** (par concept, de session en session) + bonus individuel via un ID anonyme stocké dans le navigateur. |
| Hébergement | **Netlify Functions + Netlify Blobs**, front vanilla JS sans build, sur le site existant. |

### Hors périmètre V1

Jeu C (*Atelier de prompts*), back-office d'administration, comptes utilisateurs, vrai temps réel (WebSocket), multilingue, classement nominatif.

---

## 1. Flux de jeu et déroulé (~10 min)

États pilotés par l'animateur : `open` → `reveal` → `done`.

| Temps | Écran animateur (partagé dans Meet) | Téléphone joueur |
|---|---|---|
| 0:00–1:00 | QR géant + URL courte + compteur « 7/12 connectés » | Scan → pseudo auto → **Jouer** |
| 1:00–6:00 | Progression live (qui joue / a fini), **aucune réponse affichée** | 1 échauffement + 6–7 questions ; réponses enregistrées au fil de l'eau ; écran final « En attente de la révélation… » |
| ~6:00 | **Révéler** (quand tout le monde a fini, ou forcé) : réponses verrouillées | Bascule automatique en mode révélation |
| 6:00–10:00 | Debrief question par question (◀ ▶) : répartition, bonne réponse, concept + explication. Questions sautables. | Sa réponse ✅/❌ et la répartition du groupe |
| 10:00 | **Niveau du jour** : score 0–100, concepts forts/faibles, comparaison avec l'historique | **Profil IA** + progression personnelle (si ID local connu) |

Composition type d'une partie : 1 échauffement vidéo (non compté) + ~2 *Humain ou IA ?* + ~2 *Pariez sur la machine* + 2–3 *Enquête* / *Duel de prompts*, dont 1–2 questions de **rappel** de sessions passées.

### Les mini-jeux V1

Tous partagent la mécanique **réponse + confiance** (3 crans : « Je pense », « Je suis sûr », « Certain »), et chaque question porte obligatoirement un **concept** et une **explication** affichés au debrief.

- **Humain ou IA ?** — un média (texte, image, code ou **vidéo**) ; le joueur tranche Humain / IA. Les vidéos d'IA manifestement absurdes font de bons échauffements.
- **Pariez sur la machine** — une question posée à un LLM ; le joueur prédit sa réponse (ou s'il se trompe).
- **L'Enquête** — une conversation avec une IA en bulles ; le joueur **tape la phrase fautive** (ou « Rien ne cloche »). Illustre hallucination, complaisance, perte de contexte, tokenisation…
- **Duel de prompts** — 2–3 prompts pour une même tâche ; le joueur parie sur le meilleur. Au debrief : les **vraies sorties obtenues** côte à côte et le principe de prompting en jeu.

### Résilience

- Rechargement de page → reprise au même point (ID joueur en `localStorage`).
- Retardataire arrivé après la révélation → mode spectateur.
- Réponse envoyée après la révélation → refusée (409), message « trop tard ».
- Perte réseau → la réponse est réessayée ; l'écran indique l'état « non envoyé ».

---

## 2. Contrat JSON

Tous les fichiers vivent dans `quiz-data/`, **non publié** : Netlify publie la racine du repo, donc une règle `netlify.toml` force un 404 sur `/quiz-data/*`, et les fonctions embarquent le dossier via `included_files`. Les joueurs ne reçoivent jamais les réponses avant la révélation.

### 2.1 `quiz-data/concepts.json` — référentiel

```json
{
  "concepts": [
    { "id": "hallucination", "label": "Hallucination", "family": "limites",
      "definition": "Le modèle produit une information fausse avec assurance." }
  ]
}
```

Familles : `fondamentaux`, `limites`, `prompting`, `usages`. Le référentiel grandit au fil des sessions (le skill peut proposer des ajouts).

### 2.2 `quiz-data/sessions/NN.json` — une partie

Champs communs obligatoires par question : `id`, `game`, `answer`, `concept` (existant dans le référentiel), `explanation`. Optionnels : `warmup` (bool, exclu du score), `media`, `revisits` (n° de session dont le concept est rappelé).

| `game` | Champs spécifiques | `answer` |
|---|---|---|
| `human_or_ai` | `media` | `"human"` \| `"ai"` |
| `bet_machine` | `prompt`, `choices[{id,text}]` | id d'un choix |
| `investigation` | `transcript[{role,text}]` | index de la ligne fautive, ou `null` (« rien ne cloche ») |
| `prompt_duel` | `task`, `prompts[{id,text}]`, `outputs{id: texte}` | id du meilleur prompt |

`media` : `{kind: "text"|"image"|"code"|"video", ...}`. Vidéo : `provider: "youtube"|"vimeo"` + `id`, `start`, `end` (secondes) — préféré au ré-hébergement pour les vidéos trouvées en ligne ; ou `src` pour un fichier local (`media/quiz/…`).

Exemple :

```json
{
  "session": "05",
  "title": "Le quiz brise-glace",
  "questions": [
    { "id": "q0", "game": "human_or_ai", "warmup": true,
      "media": { "kind": "video", "provider": "youtube", "id": "abc123", "start": 12, "end": 27 },
      "answer": "ai", "concept": "video-generation",
      "explanation": "Mains à 6 doigts et physique de l'eau : la génération se trahit." },
    { "id": "q2", "game": "investigation",
      "transcript": [
        { "role": "user", "text": "Cite-moi une étude sur le télétravail." },
        { "role": "ai", "text": "Bien sûr !" },
        { "role": "ai", "text": "Selon Dupont et al. (2021), Nature, p. 42…" }
      ],
      "answer": 2, "concept": "hallucination", "revisits": "03",
      "explanation": "Cette référence n'existe pas : le modèle génère une citation plausible." }
  ]
}
```

La confiance n'apparaît pas dans le contrat : c'est une mécanique transverse du moteur.

**Validateur** `scripts/quiz-validate.mjs` (Node, sans dépendance) : schéma par type de jeu, unicité des `id`, `answer` cohérente avec les choix/lignes, `concept` existant, exactement 0 ou 1 échauffement, nombre de questions comptées entre 5 et 8.

### 2.3 `quiz-data/history.json` — mémoire collective

```json
{
  "sessions": [
    { "session": "05", "date": "2026-10-20", "players": 9, "globalScore": 62,
      "concepts": {
        "hallucination": { "asked": 1, "correctRate": 0.45, "avgConfidence": 2.4 }
      } }
  ]
}
```

Généré après chaque session par `scripts/quiz-export.mjs` (appelle `quiz-export`, ajoute l'entrée), puis commité. Agrégats uniquement, aucun pseudo.

---

## 3. Composants, scoring, profils

```
Téléphone joueur ──┐                       ┌── quiz-data/ (privé, embarqué)
  /quiz/?s=05      │   Netlify Functions   │
                   ├──►  /api/quiz/*  ─────┤
Écran animateur ───┘   (scoring serveur)   └── Netlify Blobs (état live)
  /quiz/host/?s=05                                   │
                                                     ▼ scripts/quiz-export.mjs
                                              quiz-data/history.json (commité)
```

### 3.1 Front (vanilla JS, ES modules, sans build)

- `quiz/index.html` — app joueur (rejoindre → questions → attente → révélation → profil).
- `quiz/host/index.html` — écran animateur : QR (lib depuis cdnjs, version épinglée), progression, ◀ ▶ / **Révéler** / **Terminer**, niveau du jour.
- `quiz/lib/api.js` — appels + polling (animateur 2 s, joueur en attente 3 s).
- `quiz/lib/games/{human-or-ai,bet-machine,investigation,prompt-duel}.js` — chaque module expose `renderQuestion(q, onAnswer)` et `renderReveal(q, stats, mine)`. Ajouter un jeu = un module + un schéma de validateur + une règle de scoring ; le moteur ne change pas.
- `quiz/lib/media.js` — rendu texte / image / code / vidéo (embed avec extrait, ou `<video>`).
- `quiz/lib/scoring.js`, `quiz/lib/profiles.js`, `quiz/lib/pseudo.js` — fonctions pures, partagées front/fonctions.
- `quiz/quiz.css` — mobile first, tokens de design AI Coffee.

### 3.2 Fonctions (`netlify/functions/`)

| Endpoint | Accès | Rôle |
|---|---|---|
| `GET quiz-game?s=NN` | public | Questions **sans réponses** + état ; après révélation : réponses, explications, répartitions |
| `POST quiz-join` | public | `{pseudo, uid?}` → `{pid}` |
| `POST quiz-answer` | public | `{pid, qid, choice, confidence}` ; idempotent avant révélation, 409 après |
| `GET quiz-me?s=NN&pid=` | public | Score, profil, progression (après révélation) |
| `GET quiz-host-state?s=NN` | clé animateur | Joueurs, progression, agrégats |
| `POST quiz-host` | clé animateur | `open` / `reveal` / `goto` / `finish` / `reset` |
| `GET quiz-export?s=NN` | clé animateur | Entrée agrégée pour `history.json` |

- **Clé animateur** : variable d'environnement `QUIZ_HOST_KEY`, passée dans le fragment d'URL (`/quiz/host/?s=05#key=…`), mémorisée en `localStorage`, envoyée en en-tête `Authorization`. Jamais dans le repo.
- **Validation des entrées** : `qid`/`choice` existants, `confidence ∈ {1,2,3}`, pseudo ≤ 24 caractères, échappé à l'affichage. Erreurs renvoyées en JSON `{error}` avec code HTTP explicite ; erreurs de stockage loguées.

### 3.3 Stockage (Netlify Blobs, store `quiz`)

- `games/NN/state` → `{status, revealIndex}`
- `games/NN/players/<pid>` → `{pseudo, uid?, answers: {qid: {choice, confidence}}}` — un blob par joueur, pas de conflit d'écriture.
- `members/<uid>` → `[{session, score, concepts}]` — progression individuelle, UUID anonyme uniquement.

### 3.4 Scoring

| Confiance | ✅ Juste | ❌ Faux |
|---|---|---|
| 1 · Je pense | 70 | 30 |
| 2 · Je suis sûr | 85 | 15 |
| 3 · Certain | 100 | 0 |

- Score joueur = moyenne sur les questions répondues (échauffement exclu), 0–100. Une question non répondue n'est pas comptée.
- Niveau du jour = moyenne des scores joueurs + taux de réussite par concept, comparé à la dernière occurrence du concept dans `history.json`.

### 3.5 Profils (valeurs par défaut, modifiables dans `profiles.js`)

Axes : **justesse** (≥ 60 % de bonnes réponses) × **assurance** (confiance moyenne ≥ 2).

| | Assurance haute | Assurance basse |
|---|---|---|
| **Justesse haute** | 🎯 Oracle calibré | 🧐 Sceptique éclairé |
| **Justesse basse** | 🚀 Optimiste téméraire | 🔭 Explorateur prudent |

Chaque profil : une phrase + « À revoir : » les concepts ratés. Badge bonus : 🕵️ *Détecteur de machines* (toutes les *Humain ou IA ?* justes).

Pseudo par défaut : adjectif × nom IA tirés au sort (« Transformer Tranquille », « Token Têtu », « Agent Distrait »).

---

## 4. Génération du contenu, intégration et livrable

### 4.1 Skill `quiz` (`.claude/skills/quiz/SKILL.md`)

Sur le modèle du skill `deck`. Entrée : un numéro de session. Étapes :

1. Lire `sessions/NN.md` (thème, talks, section *Concepts / rappels*), `quiz-data/concepts.json`, `quiz-data/history.json`.
2. Choisir les **concepts cibles** :
   - 3–4 concepts liés au thème de la session ;
   - 1–2 **rappels** : concepts faibles (`correctRate < 0.6`) en priorité, puis concepts non revus depuis ≥ 2 sessions (répétition espacée). Marqués `revisits`.
3. Composer 1 échauffement + 6–7 questions en respectant le mélange de jeux, avec un concept et une explication pédagogique (1–2 phrases) par question.
4. **Contenus vérifiables uniquement** :
   - *Pariez sur la machine* et *Duel de prompts* : les réponses/sorties doivent être **réellement obtenues** auprès d'un modèle nommé ; le skill les exécute ou les laisse marquées `"verify": true` pour un organisateur.
   - *Humain ou IA ?* vidéo : le skill propose des candidats (lien + extrait), un organisateur **vérifie** la disponibilité et l'origine avant de valider.
5. Proposer d'éventuels nouveaux concepts pour `concepts.json`.
6. Lancer `scripts/quiz-validate.mjs` ; ne proposer le fichier que s'il passe.

Les organisateurs relisent puis commitent `quiz-data/sessions/NN.json`.

### 4.2 Intégration à la session

- **Deck** : une diapositive « Brise-glace » en ouverture avec le QR code vers `/quiz/?s=NN` (ajout d'un archétype ou d'un bloc dans `decks/_template/` et `TEMPLATE-GUIDE.md`).
- **Chat Meet** : l'URL courte est collée en même temps.
- **Pendant le jeu** : l'animateur partage l'onglet `/quiz/host/` à la place du deck, puis revient au deck.
- **Après la session** : `scripts/quiz-export.mjs NN` → commit de `history.json`.

### 4.3 Livrable V1 (pour la session 05)

1. `netlify.toml` (fonctions, 404 sur `quiz-data/`), fonctions + Blobs.
2. App joueur + écran animateur, 4 mini-jeux, scoring, profils, pseudo.
3. Contrat : `concepts.json` initial (~15 concepts couvrant les sessions 01–04), validateur.
4. Skill `quiz` + `quiz-data/sessions/05.json` généré et relu.
5. `history.json` initialisé (vide — aucune donnée réelle pour 01–04).
6. Script d'export, diapositive QR dans le template.
7. **Répétition** : partie complète à 2 organisateurs + 3 joueurs simulés, chronométrée (≤ 12 min).

### 4.4 Tests

- `node --test` sur les fonctions pures : scoring, profils, filtrage des réponses avant révélation, validateur (cas valides + au moins deux cas d'erreur chacun).
- Script `scripts/quiz-simulate.mjs` : 3 joueurs simulés contre `netlify dev`, du `join` à `quiz-me`.
- Vérification manuelle mobile (iOS Safari, Android Chrome) dont lecture vidéo embarquée.

### 4.5 Risques

| Risque | Parade |
|---|---|
| Vidéo retirée / embed bloqué | Vérification la veille ; repli sur une image fixe (`media.fallback`) |
| Fuite des réponses | `quiz-data/` non publié ; filtrage serveur testé |
| Dépassement du temps | Révélation forcée ; questions sautables au debrief |
| Contenu pédagogique faux | Sorties LLM réellement capturées, relecture humaine obligatoire |
| Données personnelles | Pseudo jetable, UUID anonyme, agrégats seuls dans le repo |

### 4.6 Questions ouvertes

- Date exacte de la session 05 et URL courte souhaitée (ex. `aicoffee.fr/quiz`).
- Nom public du module (« Brise-glace », « Warm-up IA », …).
