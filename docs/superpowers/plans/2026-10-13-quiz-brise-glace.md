# Quiz brise-glace — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer le module de quiz brise-glace (app joueur, écran animateur, API, contrat JSON, historique, skill de génération), utilisable en ouverture de la session 05.

**Architecture :** front statique en vanilla JS (modules ES, sans build) servi par Netlify depuis la racine du repo. Une seule fonction Netlify (`/api/quiz/*`) porte toute la logique serveur, écrite comme une fabrique `createApi({store, content, …})` testable avec un store en mémoire. L'état live vit dans Netlify Blobs. Le contenu (`quiz-data/`) est importé et embarqué dans la fonction, et jamais servi publiquement. Les fonctions pures (scoring, profils, pseudo) sont partagées entre le front et la fonction.

**Tech Stack :** Node 22, `node:test`, Netlify Functions (syntaxe moderne `export default async (req) => Response` + `config.path`), `@netlify/blobs` ^11, `netlify-cli` 27 via `pnpm --package=netlify-cli@27 dlx netlify` (dev local, non installé dans le projet pour ne pas alourdir les builds Netlify), pnpm, `qrcode-generator` 1.4.4 (cdnjs), tokens de `design/tokens.css`.

**Spec :** `docs/superpowers/specs/2026-10-13-quiz-brise-glace-design.md`

## Global Constraints

- Jeu + debrief : **8 à 12 min** (cible 10).
- Une partie : **5 à 8 questions comptées** et **au plus 1 échauffement** (`warmup`, exclu du score).
- Confiance à 3 crans : `1` « Je pense », `2` « Je suis sûr », `3` « Certain ».
- Points : juste/faux = `70/30` (1), `85/15` (2), `100/0` (3). Score joueur = moyenne arrondie des questions répondues, hors échauffement. Une question non répondue n'est pas comptée.
- Profils : justesse ≥ `0.6` × confiance moyenne ≥ `2` → 🎯 Oracle calibré / 🧐 Sceptique éclairé / 🚀 Optimiste téméraire / 🔭 Explorateur prudent. Badge 🕵️ *Détecteur de machines*.
- Pseudo : 24 caractères max, généré par défaut. Aucune donnée perso au-delà du pseudo et d'un UUID anonyme. Seuls des agrégats sont commités.
- `quiz-data/` n'est **jamais** servi publiquement. Aucune réponse n'est envoyée aux joueurs avant la révélation.
- Pas de build côté front. Pas de redéclaration des tokens de `design/tokens.css`. L'UI est en français.
- Jeux V1 : `human_or_ai`, `bet_machine`, `investigation`, `prompt_duel`. Ajouter un jeu = un module front + un schéma validateur + une règle `isValidChoice`, sans toucher au moteur.
- Clé animateur : variable d'environnement `QUIZ_HOST_KEY`, jamais commitée.

### Écarts assumés par rapport à la spec

1. **État initial `closed`** avant `open` : une partie n'est jouable qu'après le clic animateur « Ouvrir la partie ». Cela évite les réponses parasites avant la session.
2. **QR code sur l'écran animateur** et non dans le deck. Le deck reçoit une diapo d'archétype *Démo* avec l'URL, puisque l'animateur partage l'écran animateur pendant le jeu. Le système de deck reste inchangé.
3. **Une seule fonction `/api/quiz/*`** avec une table de routes, au lieu de 7 fonctions nommées : un seul bundle, un seul point d'entrée pour la validation et les erreurs.
4. **Contenu embarqué par des imports JSON esbuild** (attributs d'import `with { type: "json" }`) au lieu de `included_files` : les parties et l'historique sont figés dans le bundle au moment du build.
5. **Script `dev`** : `pnpm --package=netlify-cli@27 dlx netlify dev`. La forme `pnpm dlx netlify-cli@27 dev` échoue avec `ERR_PNPM_DLX_MULTIPLE_BINS`, car le paquet expose plusieurs binaires.
6. **Un blob par réponse** (`games/NN/answers/<pid>/<qid>`) en plus du blob d'identité par joueur (`games/NN/players/<pid>`, sans `answers`) : deux réponses envoyées en parallèle par le même téléphone écrasaient sinon l'une l'autre dans le blob joueur. L'API reconstitue `answers` à la lecture.

---

## Carte des fichiers

| Fichier | Responsabilité |
|---|---|
| `package.json`, `pnpm-lock.yaml` | Dépendance `@netlify/blobs`, scripts `test` / `dev` / `quiz:*` |
| `netlify.toml` | Bundler des fonctions, `NODE_VERSION`, 404 forcés sur `quiz-data/`, `node_modules/`, `netlify/`, `tests/`, `scripts/`, `.superpowers/`, `.env*` |
| `quiz-data/concepts.json` | Référentiel des concepts |
| `quiz-data/sessions/<id>.json` | Une partie par session (contrat) |
| `quiz-data/sessions/index.mjs` | Registre : importe chaque partie (embarquée par esbuild) |
| `quiz-data/history.json` | Agrégats par session (commité après export) |
| `netlify/lib/quiz/validate.mjs` | `validateConcepts`, `validateGame` |
| `netlify/lib/quiz/content.mjs` | `createContent` : `getGame`, `publicGame`, `compareWithHistory`, `conceptLabel` |
| `netlify/lib/quiz/history.mjs` | `upsertHistory` |
| `netlify/lib/quiz/api.mjs` | `createApi` (routes, validation, Blobs), `isValidChoice` |
| `netlify/functions/quiz-api.mjs` | Branchement Netlify : Blobs + env + `config.path` |
| `quiz/lib/scoring.js` | `scoreAnswer`, `isCorrect`, `choiceKey`, `scorePlayer`, `aggregate` |
| `quiz/lib/profiles.js` | `PROFILES`, `profileFor`, `BADGES`, `badgesFor` |
| `quiz/lib/pseudo.js` | `randomPseudo`, `cleanPseudo`, `MAX_PSEUDO_LENGTH` |
| `quiz/lib/dom.js`, `quiz/lib/api.js`, `quiz/lib/media.js` | Helpers DOM, client HTTP + polling, rendu média |
| `quiz/lib/games/*.js` | Un module par jeu + `common.js` + `index.js` |
| `quiz/index.html`, `quiz/app.js` | App joueur |
| `quiz/host/index.html`, `quiz/host/host.js` | Écran animateur |
| `quiz/quiz.css` | Styles joueur + animateur |
| `scripts/quiz-validate.mjs`, `scripts/quiz-export.mjs`, `scripts/quiz-simulate.mjs` | CLI |
| `tests/helpers/memory-store.mjs`, `tests/fixtures/quiz.mjs`, `tests/quiz/*.test.mjs` | Tests |
| `.claude/skills/quiz/SKILL.md` | Skill de génération d'une partie |

---

### Task 1 : outillage + référentiel de concepts + validateur

**Files :**
- Create : `package.json`, `quiz-data/concepts.json`, `netlify/lib/quiz/validate.mjs`, `tests/fixtures/quiz.mjs`, `tests/quiz/validate.test.mjs`
- Modify : `.gitignore` (ajout en fin de fichier)

**Interfaces :**
- Produces : `validateConcepts(doc) -> string[]`, `validateGame(game, conceptsDoc, {strict?}) -> {errors: string[], warnings: string[]}`, `GAMES`, `FAMILIES`, `SESSION_RE` ; fixtures `fixtureGame`, `fixtureConcepts` (utilisées par toutes les tâches de test suivantes).

- [ ] **Step 1 : créer `package.json` et installer**

```json
{
  "name": "ai-coffee",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/**/*.test.mjs\"",
    "dev": "pnpm --package=netlify-cli@27 dlx netlify dev",
    "quiz:validate": "node scripts/quiz-validate.mjs",
    "quiz:export": "node scripts/quiz-export.mjs",
    "quiz:simulate": "node scripts/quiz-simulate.mjs"
  }
}
```

Run : `pnpm add @netlify/blobs@^11`
Expected : `pnpm-lock.yaml` créé, `node_modules/` présent.

Ajouter à la fin de `.gitignore` :

```
# Node / Netlify
node_modules/
.netlify/
```

- [ ] **Step 2 : écrire les fixtures de test** (`tests/fixtures/quiz.mjs`)

```js
// Small but complete game used by every quiz test: 1 warmup + 6 counted questions,
// covering all four games, including an « investigation » whose answer is null.
export const fixtureConcepts = {
  concepts: [
    { id: "hallucination", label: "Hallucination", family: "limites", definition: "Le modèle produit une information fausse avec assurance." },
    { id: "tokenization", label: "Tokenisation", family: "fondamentaux", definition: "Le modèle lit des tokens, pas des lettres." },
    { id: "prompt-context", label: "Donner du contexte", family: "prompting", definition: "Plus la tâche est située, meilleure est la réponse." },
    { id: "ai-detection", label: "Repérer l'IA", family: "limites", definition: "Indices qui trahissent un contenu généré." },
  ],
};

export const fixtureGame = {
  session: "test",
  title: "Partie de test",
  questions: [
    { id: "q0", game: "human_or_ai", warmup: true, media: { kind: "text", text: "Bip." }, answer: "ai", concept: "ai-detection", explanation: "Échauffement." },
    { id: "q1", game: "human_or_ai", media: { kind: "text", text: "Les sanglots longs des violons de l'automne" }, answer: "human", concept: "ai-detection", explanation: "Verlaine, 1866." },
    { id: "q2", game: "bet_machine", prompt: "Combien de r dans strawberry ?", choices: [{ id: "a", text: "2" }, { id: "b", text: "3" }], answer: "a", concept: "tokenization", explanation: "Tokens, pas lettres." },
    { id: "q3", game: "investigation", transcript: [{ role: "user", text: "Cite une étude." }, { role: "ai", text: "Bien sûr !" }, { role: "ai", text: "Dupont et al. (2021), Nature." }], answer: 2, concept: "hallucination", explanation: "Référence inventée." },
    { id: "q4", game: "prompt_duel", task: "Résumer une réunion", prompts: [{ id: "a", text: "Résume ça." }, { id: "b", text: "Résume en 5 puces pour la direction." }], outputs: { a: "Long résumé.", b: "• Point 1" }, answer: "b", concept: "prompt-context", explanation: "Format et public." },
    { id: "q5", game: "investigation", transcript: [{ role: "user", text: "Bonjour en espagnol ?" }, { role: "ai", text: "« Hola »." }], answer: null, concept: "hallucination", explanation: "Rien ne cloche." },
    { id: "q6", game: "bet_machine", prompt: "Combien de tokens pour « bonjour » ?", choices: [{ id: "a", text: "1" }, { id: "b", text: "7" }], answer: "a", concept: "tokenization", explanation: "Un mot courant tient souvent en un token." },
  ],
};
```

- [ ] **Step 3 : écrire les tests qui échouent** (`tests/quiz/validate.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConcepts, validateGame } from "../../netlify/lib/quiz/validate.mjs";
import { fixtureConcepts, fixtureGame } from "../fixtures/quiz.mjs";

const clone = () => structuredClone(fixtureGame);
const has = (list, text) => assert.ok(list.some((e) => e.includes(text)), `« ${text} » absent de ${JSON.stringify(list)}`);

test("the fixture game is valid", () => {
  const { errors, warnings } = validateGame(clone(), fixtureConcepts);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("duplicate question ids are rejected", () => {
  const g = clone();
  g.questions[2].id = "q1";
  has(validateGame(g, fixtureConcepts).errors, "q1: id dupliqué");
});

test("unknown concepts are rejected", () => {
  const g = clone();
  g.questions[1].concept = "nope";
  has(validateGame(g, fixtureConcepts).errors, "q1: concept inconnu « nope »");
});

test("an investigation answer must point to an ai line or be null", () => {
  const g = clone();
  g.questions[3].answer = 0;
  has(validateGame(g, fixtureConcepts).errors, "q3: answer doit désigner une ligne « ai » ou null");
});

test("a prompt duel needs one output per prompt", () => {
  const g = clone();
  delete g.questions[4].outputs.b;
  has(validateGame(g, fixtureConcepts).errors, "q4: outputs manquant pour le prompt « b »");
});

test("a game needs 5 to 8 counted questions", () => {
  const g = clone();
  g.questions = g.questions.slice(0, 5);
  has(validateGame(g, fixtureConcepts).errors, "partie: 5 à 8 questions comptées attendues (4)");
});

test("a game has at most one warmup", () => {
  const g = clone();
  g.questions[1].warmup = true;
  has(validateGame(g, fixtureConcepts).errors, "partie: au plus 1 échauffement (2)");
});

test("a video extract must end after it starts", () => {
  const g = clone();
  g.questions[1].media = { kind: "video", provider: "youtube", id: "x", start: 20, end: 10 };
  has(validateGame(g, fixtureConcepts).errors, "q1: media.end doit être > media.start");
});

test("verify: true warns, and fails in strict mode", () => {
  const g = clone();
  g.questions[2].verify = true;
  const loose = validateGame(g, fixtureConcepts);
  assert.deepEqual(loose.errors, []);
  assert.deepEqual(loose.warnings, ["q2: contenu à vérifier (verify: true)"]);
  has(validateGame(g, fixtureConcepts, { strict: true }).errors, "q2: contenu à vérifier (verify: true)");
});

test("validateConcepts rejects duplicates and unknown families", () => {
  assert.deepEqual(validateConcepts(fixtureConcepts), []);
  const doc = structuredClone(fixtureConcepts);
  doc.concepts.push({ ...doc.concepts[0] });
  doc.concepts[1].family = "magie";
  const errors = validateConcepts(doc);
  has(errors, "hallucination: id dupliqué");
  has(errors, "tokenization: famille inconnue « magie »");
});
```

- [ ] **Step 4 : vérifier l'échec**

Run : `pnpm test`
Expected : FAIL, `Cannot find module '.../netlify/lib/quiz/validate.mjs'`.

- [ ] **Step 5 : implémenter** `netlify/lib/quiz/validate.mjs`

```js
// Validates the quiz content contract (quiz-data/). Shared by scripts/quiz-validate.mjs
// and the tests. Messages are French: they are read by the organisers.
export const GAMES = ["human_or_ai", "bet_machine", "investigation", "prompt_duel"];
export const FAMILIES = ["fondamentaux", "limites", "prompting", "usages"];
export const SESSION_RE = /^[a-z0-9-]{1,20}$/;
const MEDIA_KINDS = ["text", "image", "code", "video"];

const isText = (v) => typeof v === "string" && v.trim().length > 0;
const uniqueItems = (items) =>
  Array.isArray(items) &&
  items.every((x) => isText(x?.id) && isText(x?.text)) &&
  new Set(items.map((x) => x.id)).size === items.length;

export function validateConcepts(doc) {
  if (!Array.isArray(doc?.concepts)) return ["concepts: tableau « concepts » manquant"];
  const errors = [];
  const seen = new Set();
  for (const c of doc.concepts) {
    const id = c?.id ?? "?";
    if (!/^[a-z0-9-]+$/.test(c?.id ?? "")) errors.push(`${id}: id invalide`);
    if (seen.has(id)) errors.push(`${id}: id dupliqué`);
    seen.add(id);
    if (!isText(c?.label)) errors.push(`${id}: label manquant`);
    if (!FAMILIES.includes(c?.family)) errors.push(`${id}: famille inconnue « ${c?.family} »`);
    if (!isText(c?.definition)) errors.push(`${id}: definition manquante`);
  }
  return errors;
}

function validateMedia(id, media, errors) {
  if (!media || typeof media !== "object") return errors.push(`${id}: media manquant`);
  if (!MEDIA_KINDS.includes(media.kind)) return errors.push(`${id}: media.kind inconnu « ${media.kind} »`);
  if ((media.kind === "text" || media.kind === "code") && !isText(media.text)) errors.push(`${id}: media.text manquant`);
  if (media.kind === "image" && (!isText(media.src) || !isText(media.alt))) errors.push(`${id}: media.src et media.alt requis`);
  if (media.kind === "video") {
    if (media.src === undefined) {
      if (!["youtube", "vimeo"].includes(media.provider) || !isText(media.id)) {
        errors.push(`${id}: vidéo : provider (youtube|vimeo) + id, ou src, requis`);
      }
      if (media.start !== undefined && !(Number.isInteger(media.start) && media.start >= 0)) errors.push(`${id}: media.start invalide`);
      if (media.end !== undefined && !(Number.isInteger(media.end) && media.end > (media.start ?? 0))) {
        errors.push(`${id}: media.end doit être > media.start`);
      }
    } else if (!isText(media.src)) {
      errors.push(`${id}: media.src invalide`);
    }
  }
  if (media.fallback !== undefined && !isText(media.fallback)) errors.push(`${id}: media.fallback invalide`);
}

function validateQuestion(q, conceptIds, errors) {
  const id = isText(q?.id) ? q.id : "?";
  if (!GAMES.includes(q?.game)) return errors.push(`${id}: jeu inconnu « ${q?.game} »`);
  if (!conceptIds.has(q.concept)) errors.push(`${id}: concept inconnu « ${q.concept} »`);
  if (!isText(q.explanation)) errors.push(`${id}: explanation manquante`);
  if (q.warmup !== undefined && typeof q.warmup !== "boolean") errors.push(`${id}: warmup doit être un booléen`);
  if (q.revisits !== undefined && !SESSION_RE.test(q.revisits)) errors.push(`${id}: revisits invalide`);
  if (q.media !== undefined || q.game === "human_or_ai") validateMedia(id, q.media, errors);

  switch (q.game) {
    case "human_or_ai":
      if (!["human", "ai"].includes(q.answer)) errors.push(`${id}: answer doit valoir "human" ou "ai"`);
      break;
    case "bet_machine":
      if (!isText(q.prompt)) errors.push(`${id}: prompt manquant`);
      if (!uniqueItems(q.choices) || q.choices.length < 2) errors.push(`${id}: au moins 2 choices {id, text} aux id uniques`);
      else if (!q.choices.some((c) => c.id === q.answer)) errors.push(`${id}: answer ne correspond à aucun choix`);
      break;
    case "investigation": {
      const lines = q.transcript;
      const wellFormed =
        Array.isArray(lines) && lines.length >= 2 && lines.every((l) => ["user", "ai"].includes(l?.role) && isText(l?.text));
      if (!wellFormed) errors.push(`${id}: transcript d'au moins 2 lignes {role: user|ai, text} requis`);
      else if (!(q.answer === null || (Number.isInteger(q.answer) && lines[q.answer]?.role === "ai"))) {
        errors.push(`${id}: answer doit désigner une ligne « ai » ou null`);
      }
      break;
    }
    case "prompt_duel":
      if (!isText(q.task)) errors.push(`${id}: task manquante`);
      if (!uniqueItems(q.prompts) || q.prompts.length < 2) {
        errors.push(`${id}: au moins 2 prompts {id, text} aux id uniques`);
      } else {
        for (const p of q.prompts) if (!isText(q.outputs?.[p.id])) errors.push(`${id}: outputs manquant pour le prompt « ${p.id} »`);
        if (!q.prompts.some((p) => p.id === q.answer)) errors.push(`${id}: answer ne correspond à aucun prompt`);
      }
      break;
  }
}

export function validateGame(game, conceptsDoc, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const conceptIds = new Set((conceptsDoc?.concepts ?? []).map((c) => c.id));

  if (!SESSION_RE.test(game?.session ?? "")) errors.push(`partie: session invalide « ${game?.session} »`);
  if (!isText(game?.title)) errors.push("partie: title manquant");
  if (!Array.isArray(game?.questions)) return { errors: [...errors, "partie: questions manquantes"], warnings };

  const seen = new Set();
  for (const q of game.questions) {
    const id = isText(q?.id) ? q.id : "?";
    if (seen.has(id)) errors.push(`${id}: id dupliqué`);
    seen.add(id);
    validateQuestion(q, conceptIds, errors);
    if (q?.verify === true) (strict ? errors : warnings).push(`${id}: contenu à vérifier (verify: true)`);
  }

  const warmups = game.questions.filter((q) => q?.warmup === true).length;
  const counted = game.questions.length - warmups;
  if (warmups > 1) errors.push(`partie: au plus 1 échauffement (${warmups})`);
  if (counted < 5 || counted > 8) errors.push(`partie: 5 à 8 questions comptées attendues (${counted})`);
  return { errors, warnings };
}
```

- [ ] **Step 6 : vérifier le succès**

Run : `pnpm test`
Expected : PASS (10 tests).

- [ ] **Step 7 : écrire le référentiel initial** `quiz-data/concepts.json`

```json
{
  "concepts": [
    { "id": "tokenization", "label": "Tokenisation", "family": "fondamentaux", "definition": "Le modèle découpe le texte en tokens (morceaux de mots) : il ne voit pas les lettres une à une." },
    { "id": "next-token", "label": "Prédiction du mot suivant", "family": "fondamentaux", "definition": "Un LLM génère son texte token par token, en prédisant la suite la plus probable." },
    { "id": "context-window", "label": "Fenêtre de contexte", "family": "fondamentaux", "definition": "La quantité de texte que le modèle peut prendre en compte à la fois ; au-delà, il oublie ou se perd." },
    { "id": "training-cutoff", "label": "Date de coupure", "family": "fondamentaux", "definition": "Le modèle ne sait que ce qu'il a vu à l'entraînement ; sans outil, il ignore l'actualité." },
    { "id": "non-determinism", "label": "Non-déterminisme", "family": "fondamentaux", "definition": "La même question peut donner des réponses différentes d'une fois sur l'autre." },
    { "id": "hallucination", "label": "Hallucination", "family": "limites", "definition": "Le modèle produit une information fausse avec assurance." },
    { "id": "sycophancy", "label": "Complaisance", "family": "limites", "definition": "Le modèle tend à donner raison à l'utilisateur, même quand celui-ci a tort." },
    { "id": "bias", "label": "Biais", "family": "limites", "definition": "Le modèle reproduit les biais présents dans ses données d'entraînement." },
    { "id": "ai-detection", "label": "Repérer l'IA", "family": "limites", "definition": "Les indices qui trahissent un contenu généré, et les limites de cette détection." },
    { "id": "prompt-context", "label": "Donner du contexte", "family": "prompting", "definition": "Plus la tâche est située (but, public, contraintes), meilleure est la réponse." },
    { "id": "prompt-examples", "label": "Montrer des exemples", "family": "prompting", "definition": "Quelques exemples de la sortie attendue (few-shot) guident mieux qu'une longue consigne." },
    { "id": "prompt-role", "label": "Donner un rôle", "family": "prompting", "definition": "Attribuer un rôle ou un public cible oriente le ton et le niveau de détail." },
    { "id": "prompt-format", "label": "Préciser le format", "family": "prompting", "definition": "Demander une forme de sortie explicite (puces, tableau, longueur) rend la réponse exploitable." },
    { "id": "video-generation", "label": "Vidéo générée", "family": "usages", "definition": "Les modèles vidéo produisent des scènes crédibles, mais trahissent souvent la physique, les mains ou le texte." },
    { "id": "agent", "label": "Agent", "family": "usages", "definition": "Un modèle qui enchaîne des actions (lire, chercher, exécuter) pour atteindre un objectif." },
    { "id": "tool-use", "label": "Appel d'outils", "family": "usages", "definition": "Le modèle appelle des outils externes (recherche web, API) pour agir ou s'informer." },
    { "id": "mcp", "label": "MCP", "family": "usages", "definition": "Un protocole standard pour brancher un modèle sur des outils et des services tiers." },
    { "id": "skills", "label": "Skills", "family": "usages", "definition": "Des paquets d'instructions et de ressources qui apprennent un savoir-faire à l'assistant." },
    { "id": "rag", "label": "RAG", "family": "usages", "definition": "Le modèle répond en s'appuyant sur des documents retrouvés au moment de la question." }
  ]
}
```

- [ ] **Step 8 : commit**

```bash
git add package.json pnpm-lock.yaml .gitignore quiz-data/concepts.json netlify/lib/quiz/validate.mjs tests/
git commit -m "feat(quiz): content contract validator and initial concept map

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : scoring

**Files :**
- Create : `quiz/lib/scoring.js`, `tests/quiz/scoring.test.mjs`

**Interfaces :**
- Consumes : `fixtureGame` (Task 1).
- Produces :
  - `CONFIDENCE_POINTS: {1:[70,30], 2:[85,15], 3:[100,0]}`
  - `scoreAnswer(correct: boolean, confidence: 1|2|3) -> number` (lève `RangeError` sinon)
  - `isCorrect(question, choice) -> boolean`
  - `choiceKey(choice) -> string` (`null` → `"none"`)
  - `scorePlayer(questions, answers) -> {score: number|null, answered, correct, correctRate: number|null, avgConfidence: number|null, concepts: {[id]: {answered, correct}}}`
  - `aggregate(questions, players: {answers}[]) -> {players, globalScore: number|null, perQuestion: {[qid]: {counts: {[choiceKey]: n}, answered, correctRate|null}}, concepts: {[id]: {asked, answers, correctRate|null, avgConfidence|null}}}`

- [ ] **Step 1 : tests qui échouent** (`tests/quiz/scoring.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, choiceKey, isCorrect, scoreAnswer, scorePlayer } from "../../quiz/lib/scoring.js";
import { fixtureGame } from "../fixtures/quiz.mjs";

const Q = fixtureGame.questions;
const byId = (id) => Q.find((q) => q.id === id);
// A: warmup ignored; q1 ✅ certain (100), q2 ❌ certain (0), q3 ✅ « je pense » (70) → 57
const A = { q0: { choice: "human", confidence: 3 }, q1: { choice: "human", confidence: 3 }, q2: { choice: "b", confidence: 3 }, q3: { choice: 2, confidence: 1 } };
// B: q1 ❌ « sûr » (15), q3 ✅ certain (100) → 57.5 → 58
const B = { q0: { choice: "ai", confidence: 1 }, q1: { choice: "ai", confidence: 2 }, q3: { choice: 2, confidence: 3 } };

test("scoreAnswer applies the confidence table", () => {
  assert.equal(scoreAnswer(true, 1), 70);
  assert.equal(scoreAnswer(false, 1), 30);
  assert.equal(scoreAnswer(true, 2), 85);
  assert.equal(scoreAnswer(false, 2), 15);
  assert.equal(scoreAnswer(true, 3), 100);
  assert.equal(scoreAnswer(false, 3), 0);
  assert.throws(() => scoreAnswer(true, 4), RangeError);
});

test("isCorrect and choiceKey handle the « rien ne cloche » null choice", () => {
  assert.equal(isCorrect(byId("q5"), null), true);
  assert.equal(isCorrect(byId("q3"), null), false);
  assert.equal(isCorrect(byId("q3"), 2), true);
  assert.equal(choiceKey(null), "none");
  assert.equal(choiceKey(2), "2");
  assert.equal(choiceKey("ai"), "ai");
});

test("scorePlayer ignores the warmup and averages answered questions", () => {
  const r = scorePlayer(Q, A);
  assert.equal(r.score, 57);
  assert.equal(r.answered, 3);
  assert.equal(r.correct, 2);
  assert.ok(Math.abs(r.correctRate - 2 / 3) < 1e-9);
  assert.ok(Math.abs(r.avgConfidence - 7 / 3) < 1e-9);
  assert.deepEqual(r.concepts, {
    "ai-detection": { answered: 1, correct: 1 },
    tokenization: { answered: 1, correct: 0 },
    hallucination: { answered: 1, correct: 1 },
  });
});

test("scorePlayer returns null scores when nothing counted was answered", () => {
  for (const answers of [{}, { q0: { choice: "ai", confidence: 3 } }]) {
    const r = scorePlayer(Q, answers);
    assert.equal(r.score, null);
    assert.equal(r.correctRate, null);
    assert.equal(r.avgConfidence, null);
  }
});

test("aggregate builds per-question and per-concept stats", () => {
  const agg = aggregate(Q, [{ answers: A }, { answers: B }]);
  assert.equal(agg.players, 2);
  assert.equal(agg.globalScore, 58);
  assert.deepEqual(agg.perQuestion.q0, { counts: { human: 1, ai: 1 }, answered: 2, correctRate: 0.5 });
  assert.deepEqual(agg.perQuestion.q3, { counts: { 2: 2 }, answered: 2, correctRate: 1 });
  assert.deepEqual(agg.perQuestion.q4, { counts: {}, answered: 0, correctRate: null });
  assert.deepEqual(agg.concepts.hallucination, { asked: 2, answers: 2, correctRate: 1, avgConfidence: 2 });
  assert.deepEqual(agg.concepts.tokenization, { asked: 2, answers: 1, correctRate: 0, avgConfidence: 3 });
  assert.deepEqual(agg.concepts["ai-detection"], { asked: 1, answers: 2, correctRate: 0.5, avgConfidence: 2.5 });
  assert.deepEqual(agg.concepts["prompt-context"], { asked: 1, answers: 0, correctRate: null, avgConfidence: null });
});

test("aggregate of an empty room", () => {
  const agg = aggregate(Q, []);
  assert.equal(agg.players, 0);
  assert.equal(agg.globalScore, null);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm test`
Expected : FAIL, `Cannot find module '.../quiz/lib/scoring.js'`.

- [ ] **Step 3 : implémenter** `quiz/lib/scoring.js`

```js
// Scoring rewards being right AND being calibrated: a confident mistake costs more
// than a hesitant one. Pure functions, shared by the browser and the Netlify function.
export const CONFIDENCE_POINTS = { 1: [70, 30], 2: [85, 15], 3: [100, 0] };

export function scoreAnswer(correct, confidence) {
  const points = CONFIDENCE_POINTS[confidence];
  if (!points) throw new RangeError(`confidence must be 1, 2 or 3 (got ${confidence})`);
  return correct ? points[0] : points[1];
}

export const isCorrect = (question, choice) => choice === question.answer;

// Answers are counted per choice; « rien ne cloche » (null) needs a string key.
export const choiceKey = (choice) => (choice === null ? "none" : String(choice));

const ratio = (part, whole) => (whole ? part / whole : null);

export function scorePlayer(questions, answers = {}) {
  let points = 0;
  let answered = 0;
  let correct = 0;
  let confidence = 0;
  const concepts = {};
  for (const q of questions) {
    if (q.warmup) continue;
    const a = answers[q.id];
    if (!a) continue;
    const ok = isCorrect(q, a.choice);
    points += scoreAnswer(ok, a.confidence);
    answered++;
    confidence += a.confidence;
    if (ok) correct++;
    const c = (concepts[q.concept] ??= { answered: 0, correct: 0 });
    c.answered++;
    if (ok) c.correct++;
  }
  return {
    score: answered ? Math.round(points / answered) : null,
    answered,
    correct,
    correctRate: ratio(correct, answered),
    avgConfidence: ratio(confidence, answered),
    concepts,
  };
}

export function aggregate(questions, players) {
  const perQuestion = Object.fromEntries(questions.map((q) => [q.id, { counts: {}, answered: 0, correct: 0 }]));
  const concepts = {};
  for (const q of questions) {
    if (!q.warmup) (concepts[q.concept] ??= { asked: 0, answers: 0, correct: 0, confidence: 0 }).asked++;
  }

  const scores = [];
  for (const player of players) {
    const answers = player.answers ?? {};
    const { score } = scorePlayer(questions, answers);
    if (score !== null) scores.push(score);
    for (const q of questions) {
      const a = answers[q.id];
      if (!a) continue;
      const ok = isCorrect(q, a.choice);
      const pq = perQuestion[q.id];
      const key = choiceKey(a.choice);
      pq.counts[key] = (pq.counts[key] ?? 0) + 1;
      pq.answered++;
      if (ok) pq.correct++;
      if (q.warmup) continue;
      const c = concepts[q.concept];
      c.answers++;
      c.confidence += a.confidence;
      if (ok) c.correct++;
    }
  }

  return {
    players: players.length,
    globalScore: scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null,
    perQuestion: Object.fromEntries(
      Object.entries(perQuestion).map(([id, pq]) => [id, { counts: pq.counts, answered: pq.answered, correctRate: ratio(pq.correct, pq.answered) }]),
    ),
    concepts: Object.fromEntries(
      Object.entries(concepts).map(([id, c]) => [
        id,
        { asked: c.asked, answers: c.answers, correctRate: ratio(c.correct, c.answers), avgConfidence: ratio(c.confidence, c.answers) },
      ]),
    ),
  };
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `pnpm test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add quiz/lib/scoring.js tests/quiz/scoring.test.mjs
git commit -m "feat(quiz): calibration-aware scoring and room aggregates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : profils et pseudos

**Files :**
- Create : `quiz/lib/profiles.js`, `quiz/lib/pseudo.js`, `tests/quiz/profiles.test.mjs`

**Interfaces :**
- Consumes : `fixtureGame` (Task 1).
- Produces :
  - `PROFILES: {oracle, sceptique, temeraire, explorateur}`, chacun de forme `{id, emoji, title, tagline}`
  - `profileFor({correctRate, avgConfidence}) -> profile|null`
  - `BADGES.detector = {id: "detector", emoji: "🕵️", title: "Détecteur de machines"}`
  - `badgesFor(questions, answers) -> badge[]`
  - `MAX_PSEUDO_LENGTH = 24`, `randomPseudo(rand = Math.random) -> string`, `cleanPseudo(input) -> string|null`

- [ ] **Step 1 : tests qui échouent** (`tests/quiz/profiles.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { badgesFor, profileFor } from "../../quiz/lib/profiles.js";
import { cleanPseudo, MAX_PSEUDO_LENGTH, randomPseudo } from "../../quiz/lib/pseudo.js";
import { fixtureGame } from "../fixtures/quiz.mjs";

test("profileFor crosses accuracy and confidence", () => {
  assert.equal(profileFor({ correctRate: 0.8, avgConfidence: 2.5 }).id, "oracle");
  assert.equal(profileFor({ correctRate: 0.8, avgConfidence: 1.5 }).id, "sceptique");
  assert.equal(profileFor({ correctRate: 0.4, avgConfidence: 2.5 }).id, "temeraire");
  assert.equal(profileFor({ correctRate: 0.4, avgConfidence: 1 }).id, "explorateur");
  assert.equal(profileFor({ correctRate: 0.6, avgConfidence: 2 }).id, "oracle"); // thresholds are inclusive
  assert.equal(profileFor({ correctRate: null, avgConfidence: null }), null);
});

test("badgesFor awards the machine detector when every counted human_or_ai is right", () => {
  const Q = fixtureGame.questions;
  assert.deepEqual(badgesFor(Q, { q1: { choice: "human", confidence: 1 } }).map((b) => b.id), ["detector"]);
  assert.deepEqual(badgesFor(Q, { q1: { choice: "ai", confidence: 1 } }), []);
  assert.deepEqual(badgesFor(Q, {}), []);
});

test("randomPseudo combines a noun and an adjective", () => {
  assert.equal(randomPseudo(() => 0), "Transformer Tranquille");
  assert.equal(randomPseudo(() => 0.999), "Vecteur Zen");
});

test("cleanPseudo trims, collapses spaces and caps the length", () => {
  assert.equal(cleanPseudo("  Token   Têtu "), "Token Têtu");
  assert.equal(cleanPseudo("x".repeat(40)).length, MAX_PSEUDO_LENGTH);
  assert.equal(cleanPseudo("   "), null);
  assert.equal(cleanPseudo(42), null);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm test`
Expected : FAIL, `Cannot find module '.../quiz/lib/profiles.js'`.

- [ ] **Step 3 : implémenter** `quiz/lib/profiles.js`

```js
// Default « profil IA » values. Tweak the copy freely; keep the ids stable
// (the host screen counts players per profile id).
export const THRESHOLDS = { correctRate: 0.6, avgConfidence: 2 };

export const PROFILES = {
  oracle: { id: "oracle", emoji: "🎯", title: "Oracle calibré", tagline: "Tu sais, et tu sais que tu sais." },
  sceptique: { id: "sceptique", emoji: "🧐", title: "Sceptique éclairé", tagline: "Tu doutes, mais tu vises juste." },
  temeraire: { id: "temeraire", emoji: "🚀", title: "Optimiste téméraire", tagline: "La machine t'a eu en beauté." },
  explorateur: { id: "explorateur", emoji: "🔭", title: "Explorateur prudent", tagline: "Tu avances à tâtons, et c'est sain." },
};

export function profileFor({ correctRate, avgConfidence }) {
  if (correctRate === null || correctRate === undefined) return null;
  const accurate = correctRate >= THRESHOLDS.correctRate;
  const confident = avgConfidence >= THRESHOLDS.avgConfidence;
  if (accurate) return confident ? PROFILES.oracle : PROFILES.sceptique;
  return confident ? PROFILES.temeraire : PROFILES.explorateur;
}

export const BADGES = {
  detector: { id: "detector", emoji: "🕵️", title: "Détecteur de machines" },
};

export function badgesFor(questions, answers = {}) {
  const humanOrAi = questions.filter((q) => q.game === "human_or_ai" && !q.warmup);
  if (!humanOrAi.length) return [];
  return humanOrAi.every((q) => answers[q.id]?.choice === q.answer) ? [BADGES.detector] : [];
}
```

- [ ] **Step 4 : implémenter** `quiz/lib/pseudo.js`

```js
// Default pseudo = an AI noun + an adjective, so joining takes a single tap.
// All nouns are masculine so the adjectives always agree.
const NOUNS = ["Transformer", "Token", "Agent", "Prompt", "Neurone", "Embedding", "Modèle", "Copilote", "Chatbot", "Vecteur"];
const ADJECTIVES = ["Tranquille", "Têtu", "Distrait", "Curieux", "Calibré", "Pressé", "Malicieux", "Rêveur", "Bavard", "Zen"];

export const MAX_PSEUDO_LENGTH = 24;

export function randomPseudo(rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return `${pick(NOUNS)} ${pick(ADJECTIVES)}`;
}

export function cleanPseudo(input) {
  if (typeof input !== "string") return null;
  const pseudo = input.replace(/\s+/g, " ").trim().slice(0, MAX_PSEUDO_LENGTH);
  return pseudo || null;
}
```

- [ ] **Step 5 : vérifier le succès**

Run : `pnpm test`
Expected : PASS.

- [ ] **Step 6 : commit**

```bash
git add quiz/lib/profiles.js quiz/lib/pseudo.js tests/quiz/profiles.test.mjs
git commit -m "feat(quiz): default AI profiles, badge and pseudo generator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : accès au contenu, historique et partie de démo

**Files :**
- Create : `netlify/lib/quiz/content.mjs`, `netlify/lib/quiz/history.mjs`, `quiz-data/history.json`, `quiz-data/sessions/demo.json`, `quiz-data/sessions/index.mjs`, `scripts/quiz-validate.mjs`, `tests/quiz/content.test.mjs`

**Interfaces :**
- Consumes : `validateConcepts`, `validateGame` (Task 1).
- Produces :
  - `createContent({sessions, concepts, history}) -> {getGame(session) -> game|null, publicGame(game, {revealed}) -> {session, title, questions}, compareWithHistory(aggConcepts, session) -> {[id]: {...agg, label, previous: {session, correctRate}|null}}, conceptLabel(id) -> string}`
  - `content` : instance branchée sur `quiz-data/`
  - `upsertHistory(doc, entry) -> {sessions}` (remplace la même session, trie par `date` puis par `session`)
  - Avant révélation, une question publique ne contient **que** : `id, game, warmup, media, prompt, choices, transcript, task, prompts`. Après révélation : la question entière + `conceptLabel` + `conceptDefinition`.

- [ ] **Step 1 : tests qui échouent** (`tests/quiz/content.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContent } from "../../netlify/lib/quiz/content.mjs";
import { upsertHistory } from "../../netlify/lib/quiz/history.mjs";
import { fixtureConcepts, fixtureGame } from "../fixtures/quiz.mjs";

const history = {
  sessions: [
    { session: "03", date: "2026-07-01", concepts: { hallucination: { asked: 1, correctRate: 0.45, avgConfidence: 2 } } },
    { session: "04", date: "2026-09-22", concepts: { hallucination: { asked: 1, correctRate: 0.6, avgConfidence: 2 } } },
    { session: "test", date: "2026-10-20", concepts: { hallucination: { asked: 1, correctRate: 0.9, avgConfidence: 2 } } },
  ],
};
const content = createContent({ sessions: { test: fixtureGame }, concepts: fixtureConcepts, history });
const SECRET = ["answer", "explanation", "outputs", "concept", "revisits", "verify"];

test("getGame only resolves registered sessions", () => {
  assert.equal(content.getGame("test"), fixtureGame);
  for (const s of ["nope", "__proto__", "constructor", undefined, null]) assert.equal(content.getGame(s), null);
});

test("publicGame hides answers, explanations, outputs and concepts before the reveal", () => {
  const pub = content.publicGame(fixtureGame, { revealed: false });
  assert.equal(pub.title, "Partie de test");
  for (const q of pub.questions) for (const field of SECRET) assert.ok(!(field in q), `${q.id} expose ${field}`);
  assert.equal(pub.questions[3].transcript.length, 3);
  assert.equal(pub.questions[4].prompts.length, 2);
});

test("publicGame reveals everything plus concept labels afterwards, without mutating the source", () => {
  const q3 = content.publicGame(fixtureGame, { revealed: true }).questions[3];
  assert.equal(q3.answer, 2);
  assert.equal(q3.conceptLabel, "Hallucination");
  assert.equal(q3.conceptDefinition, "Le modèle produit une information fausse avec assurance.");
  assert.ok(!("conceptLabel" in fixtureGame.questions[3]));
});

test("compareWithHistory finds the latest previous session for each concept", () => {
  const cmp = content.compareWithHistory(
    { hallucination: { asked: 2, answers: 2, correctRate: 1, avgConfidence: 2 }, tokenization: { asked: 2, answers: 1, correctRate: 0, avgConfidence: 3 } },
    "test",
  );
  assert.deepEqual(cmp.hallucination.previous, { session: "04", correctRate: 0.6 });
  assert.equal(cmp.hallucination.label, "Hallucination");
  assert.equal(cmp.hallucination.correctRate, 1);
  assert.equal(cmp.tokenization.previous, null);
});

test("upsertHistory appends, replaces the same session and sorts by date", () => {
  let doc = { sessions: [] };
  doc = upsertHistory(doc, { session: "05", date: "2026-10-20", players: 9 });
  doc = upsertHistory(doc, { session: "04", date: "2026-09-22", players: 7 });
  doc = upsertHistory(doc, { session: "05", date: "2026-10-20", players: 10 });
  assert.deepEqual(doc.sessions.map((e) => [e.session, e.players]), [["04", 7], ["05", 10]]);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm test`
Expected : FAIL, `Cannot find module '.../netlify/lib/quiz/content.mjs'`.

- [ ] **Step 3 : créer les données** `quiz-data/history.json`

```json
{
  "sessions": []
}
```

`quiz-data/sessions/demo.json` est une partie de répétition qui couvre les quatre jeux. Les items dont le comportement de modèle n'a pas été capturé portent `verify: true`. La démo passe donc le validateur normal, mais **pas** `--strict`, et ne doit jamais servir en session réelle telle quelle.

```json
{
  "session": "demo",
  "title": "Brise-glace — partie de démonstration",
  "questions": [
    {
      "id": "q0", "game": "human_or_ai", "warmup": true,
      "media": { "kind": "text", "text": "En tant que grille-pain connecté, je tiens à vous informer que votre tartine a atteint un niveau de dorure optimal de 87 %. Souhaitez-vous partager cette réussite sur vos réseaux sociaux ?" },
      "answer": "ai", "concept": "ai-detection",
      "explanation": "Écrit par un LLM pour l'occasion : ton serviable, précision absurde, proposition finale non sollicitée."
    },
    {
      "id": "q1", "game": "human_or_ai",
      "media": { "kind": "text", "text": "Les sanglots longs\nDes violons\nDe l'automne\nBlessent mon cœur\nD'une langueur\nMonotone." },
      "answer": "human", "concept": "ai-detection",
      "explanation": "Paul Verlaine, « Chanson d'automne » (1866). Le rythme brisé et le choix des sons sont difficiles à imiter sans tomber dans le pastiche."
    },
    {
      "id": "q2", "game": "human_or_ai",
      "media": { "kind": "text", "text": "Le café, ce compagnon fidèle des matins pressés, est bien plus qu'une simple boisson : c'est un rituel, une pause, une invitation à ralentir dans un monde qui va toujours plus vite." },
      "answer": "ai", "concept": "ai-detection",
      "explanation": "Généré par un LLM : la tournure « bien plus qu'une simple… », la triade rythmée et le cliché consensuel sont des tics typiques."
    },
    {
      "id": "q3", "game": "bet_machine", "verify": true,
      "prompt": "On demande à un assistant IA sans accès au web : « Quel temps fait-il à Lyon aujourd'hui ? »",
      "choices": [
        { "id": "a", "text": "Il donne une prévision précise" },
        { "id": "b", "text": "Il explique qu'il ne peut pas le savoir sans outil" },
        { "id": "c", "text": "Il donne la météo moyenne du mois" }
      ],
      "answer": "b", "concept": "training-cutoff",
      "explanation": "Sans outil de recherche, le modèle n'a pas accès au temps réel : ses connaissances s'arrêtent à sa date de coupure. S'il « répond » quand même, il invente."
    },
    {
      "id": "q4", "game": "investigation",
      "transcript": [
        { "role": "user", "text": "Cite-moi une étude sérieuse sur la productivité en télétravail." },
        { "role": "ai", "text": "Bien sûr, voici une référence solide :" },
        { "role": "ai", "text": "Dupont, Martin et Leroy (2021), « Remote Work and Output », Nature, vol. 590, p. 42-57." }
      ],
      "answer": 2, "concept": "hallucination",
      "explanation": "Cette référence a été inventée pour l'exemple, et un modèle peut produire exactement ce genre de citation plausible mais fausse. Toujours vérifier les sources."
    },
    {
      "id": "q5", "game": "investigation",
      "transcript": [
        { "role": "user", "text": "Combien font 17 × 24 ?" },
        { "role": "ai", "text": "17 × 24 = 408." },
        { "role": "user", "text": "Non, je suis sûr que ça fait 418." },
        { "role": "ai", "text": "Vous avez raison, toutes mes excuses : 17 × 24 = 418." }
      ],
      "answer": 3, "concept": "sycophancy",
      "explanation": "17 × 24 = 408 : la première réponse était juste. Le modèle cède à l'insistance de l'utilisateur, c'est de la complaisance."
    },
    {
      "id": "q6", "game": "investigation",
      "transcript": [
        { "role": "user", "text": "Comment dit-on « bonjour » en espagnol ?" },
        { "role": "ai", "text": "« Buenos días », ou plus simplement « Hola »." },
        { "role": "user", "text": "Et en italien ?" },
        { "role": "ai", "text": "« Buongiorno »." }
      ],
      "answer": null, "concept": "hallucination",
      "explanation": "Rien ne cloche : tout est exact. Tout n'est pas hallucination, l'enjeu est de savoir quand vérifier."
    },
    {
      "id": "q7", "game": "prompt_duel", "verify": true,
      "task": "Résumer le compte rendu d'une réunion d'équipe d'une heure",
      "prompts": [
        { "id": "a", "text": "Résume ça." },
        { "id": "b", "text": "Tu es assistant de direction. Résume ce compte rendu en 5 puces maximum pour un manager pressé : décisions prises, responsables, échéances." }
      ],
      "outputs": {
        "a": "La réunion a abordé plusieurs sujets importants concernant le projet, notamment l'avancement, les difficultés rencontrées et les prochaines étapes. Les participants ont échangé sur différents points…",
        "b": "• Décision : lancement de la V2 le 4 novembre\n• Responsable recette : Inès\n• Budget design validé (+10 %)\n• Risque : dépendance API partenaire\n• Prochain point : jeudi 10 h"
      },
      "answer": "b", "concept": "prompt-context",
      "explanation": "Un rôle, un public, un format et ce qu'on attend (décisions, responsables, échéances) transforment une réponse vague en résumé exploitable."
    }
  ]
}
```

`quiz-data/sessions/index.mjs` :

```js
// Registry of playable games. esbuild bundles these JSON files into the Netlify
// function, so quiz-data/ never has to be published. One line per session file.
import demo from "./demo.json" with { type: "json" };

export default { demo };
```

- [ ] **Step 4 : implémenter** `netlify/lib/quiz/content.mjs`

```js
import conceptsDoc from "../../../quiz-data/concepts.json" with { type: "json" };
import historyDoc from "../../../quiz-data/history.json" with { type: "json" };
import sessionRegistry from "../../../quiz-data/sessions/index.mjs";

// Allowlist, not denylist: a new secret field can never leak by default.
const PUBLIC_FIELDS = ["id", "game", "warmup", "media", "prompt", "choices", "transcript", "task", "prompts"];
const pick = (obj, fields) => Object.fromEntries(fields.filter((f) => f in obj).map((f) => [f, obj[f]]));

export function createContent({ sessions, concepts, history }) {
  const byId = new Map(concepts.concepts.map((c) => [c.id, c]));
  const conceptLabel = (id) => byId.get(id)?.label ?? id;

  return {
    conceptLabel,

    getGame(session) {
      return typeof session === "string" && Object.hasOwn(sessions, session) ? sessions[session] : null;
    },

    publicGame(game, { revealed }) {
      return {
        session: game.session,
        title: game.title,
        questions: game.questions.map((q) =>
          revealed
            ? { ...q, conceptLabel: conceptLabel(q.concept), conceptDefinition: byId.get(q.concept)?.definition ?? "" }
            : pick(q, PUBLIC_FIELDS),
        ),
      };
    },

    compareWithHistory(aggConcepts, session) {
      const past = history.sessions.filter((e) => e.session !== session);
      return Object.fromEntries(
        Object.entries(aggConcepts).map(([id, c]) => {
          const prev = past.findLast((e) => e.concepts?.[id]);
          return [id, { ...c, label: conceptLabel(id), previous: prev ? { session: prev.session, correctRate: prev.concepts[id].correctRate } : null }];
        }),
      );
    },
  };
}

export const content = createContent({ sessions: sessionRegistry, concepts: conceptsDoc, history: historyDoc });
```

`netlify/lib/quiz/history.mjs` :

```js
// history.json keeps one aggregated entry per session, ordered by date.
export function upsertHistory(doc, entry) {
  const sessions = (doc?.sessions ?? []).filter((e) => e.session !== entry.session);
  sessions.push(entry);
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session));
  return { sessions };
}
```

- [ ] **Step 5 : vérifier le succès**

Run : `pnpm test`
Expected : PASS.

- [ ] **Step 6 : CLI de validation** `scripts/quiz-validate.mjs`

```js
#!/usr/bin/env node
// Validates quiz-data/: node scripts/quiz-validate.mjs [--strict] [session…]
// --strict turns « verify: true » warnings into errors (use it before a real session).
import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { validateConcepts, validateGame } from "../netlify/lib/quiz/validate.mjs";
import registry from "../quiz-data/sessions/index.mjs";

const ROOT = new URL("../quiz-data/", import.meta.url);
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const only = args.filter((a) => !a.startsWith("--"));
const readJson = async (rel) => JSON.parse(await readFile(new URL(rel, ROOT), "utf8"));

let failed = false;
function report(label, errors, warnings = []) {
  for (const w of warnings) console.warn(`⚠️  ${label} — ${w}`);
  for (const e of errors) console.error(`❌ ${label} — ${e}`);
  if (errors.length) failed = true;
  else console.log(`✅ ${label}`);
}

const concepts = await readJson("concepts.json");
report("concepts.json", validateConcepts(concepts));

const files = (await readdir(new URL("sessions/", ROOT))).filter((f) => f.endsWith(".json")).map((f) => basename(f, ".json"));
for (const s of only.length ? only : files) {
  const label = `sessions/${s}.json`;
  if (!files.includes(s)) {
    report(label, ["fichier introuvable"]);
    continue;
  }
  const game = await readJson(`sessions/${s}.json`);
  const { errors, warnings } = validateGame(game, concepts, { strict });
  if (game.session !== s) errors.push(`le champ session doit valoir « ${s} »`);
  if (!Object.hasOwn(registry, s)) errors.push("absent de quiz-data/sessions/index.mjs");
  report(label, errors, warnings);
}

const history = await readJson("history.json");
report("history.json", Array.isArray(history.sessions) ? [] : ["tableau « sessions » manquant"]);
process.exit(failed ? 1 : 0);
```

Run : `pnpm quiz:validate`
Expected : `✅ concepts.json`, `✅ sessions/demo.json` précédé de 2 avertissements `⚠️ … verify: true` (q3, q7), `✅ history.json`, code de sortie 0.

Run : `pnpm quiz:validate --strict demo`
Expected : 2 lignes `❌ … contenu à vérifier`, code de sortie 1.

- [ ] **Step 7 : commit**

```bash
git add netlify/lib/quiz/content.mjs netlify/lib/quiz/history.mjs quiz-data/ scripts/quiz-validate.mjs tests/quiz/content.test.mjs
git commit -m "feat(quiz): content access with answer redaction, history and demo game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : API côté joueurs (routes publiques)

**Files :**
- Create : `netlify/lib/quiz/api.mjs`, `tests/helpers/memory-store.mjs`, `tests/helpers/quiz-api.mjs`, `tests/quiz/api-player.test.mjs`

**Interfaces :**
- Consumes : `aggregate`, `scorePlayer` (Task 2) ; `profileFor`, `badgesFor`, `cleanPseudo` (Task 3) ; `createContent` (Task 4).
- Produces :
  - `createApi({store, content, hostKey, maxPlayers = 40, now, newId}) -> (req: Request) => Promise<Response>`
  - `isValidChoice(question, choice) -> boolean`
  - Store attendu (sous-ensemble de `@netlify/blobs`) : `get(key, {type: "json"})`, `setJSON(key, value)`, `delete(key)`, `list({prefix}) -> {blobs: [{key}]}`
  - Clés Blobs : `games/<s>/state`, `games/<s>/players/<pid>`, `members/<uid>`
  - Routes (toutes avec `?s=<session>`) : `GET game`, `GET state`, `POST join`, `POST answer`, `GET me` (`&pid=`). Erreurs : `{error: code}` avec les codes `unknown_session` 404, `not_found` 404, `method_not_allowed` 405, `invalid_json` 400, `invalid_pseudo` 400, `game_full` 403, `not_open` 409, `invalid_player` 400, `unknown_player` 404, `unknown_question` 400, `invalid_confidence` 400, `invalid_choice` 400, `not_revealed` 409, `internal` 500.
  - États : `{status: "closed"|"open"|"reveal"|"done", revealIndex}` ; `closed` par défaut.

- [ ] **Step 1 : store en mémoire** (`tests/helpers/memory-store.mjs`)

```js
// In-memory stand-in for a Netlify Blobs store (only the calls the quiz API uses).
export function memoryStore() {
  const data = new Map();
  return {
    data,
    async get(key, { type } = {}) {
      if (!data.has(key)) return null;
      const raw = data.get(key);
      return type === "json" ? JSON.parse(raw) : raw;
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix = "" } = {}) {
      return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key, etag: "mem" })) };
    },
  };
}
```

- [ ] **Step 2 : harnais de test partagé** (`tests/helpers/quiz-api.mjs`), réutilisé par la tâche 6

```js
import assert from "node:assert/strict";
import { createApi } from "../../netlify/lib/quiz/api.mjs";
import { createContent } from "../../netlify/lib/quiz/content.mjs";
import { fixtureConcepts, fixtureGame } from "../fixtures/quiz.mjs";
import { memoryStore } from "./memory-store.mjs";

export const UID = "11111111-2222-4333-8444-555555555555";
export const A = { q0: ["human", 3], q1: ["human", 3], q2: ["b", 3], q3: [2, 1] };
export const B = { q0: ["ai", 1], q1: ["ai", 2], q3: [2, 3] };

export function setup({ hostKey = "secret", maxPlayers } = {}) {
  const store = memoryStore();
  const content = createContent({
    sessions: { test: fixtureGame },
    concepts: fixtureConcepts,
    history: { sessions: [{ session: "03", date: "2026-07-01", concepts: { hallucination: { asked: 1, correctRate: 0.45, avgConfidence: 2 } } }] },
  });
  let n = 0;
  const api = createApi({ store, content, hostKey, maxPlayers, now: () => new Date("2026-10-20T19:00:00Z"), newId: () => `p${++n}` });
  const call = async (method, path, body, key) => {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (key) headers.authorization = `Bearer ${key}`;
    const res = await api(
      new Request(`http://localhost/api/quiz/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    );
    return { status: res.status, body: await res.json() };
  };
  const host = (action, extra = {}) => call("POST", "host?s=test", { action, ...extra }, "secret");
  const play = async (pseudo, uid, answers) => {
    const { body } = await call("POST", "join?s=test", { pseudo, uid });
    for (const [qid, [choice, confidence]] of Object.entries(answers)) {
      const r = await call("POST", "answer?s=test", { pid: body.pid, qid, choice, confidence });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    return body.pid;
  };
  return { store, call, host, play };
}
```

- [ ] **Step 3 : tests qui échouent** (`tests/quiz/api-player.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidChoice } from "../../netlify/lib/quiz/api.mjs";
import { fixtureGame } from "../fixtures/quiz.mjs";
import { A, setup, UID } from "../helpers/quiz-api.mjs";

test("unknown session, unknown route and wrong method", async () => {
  const { call } = setup();
  assert.deepEqual(await call("GET", "game?s=nope"), { status: 404, body: { error: "unknown_session" } });
  assert.equal((await call("GET", "nope?s=test")).status, 404);
  assert.deepEqual(await call("GET", "join?s=test"), { status: 405, body: { error: "method_not_allowed" } });
});

test("state defaults to closed", async () => {
  const { call } = setup();
  assert.deepEqual((await call("GET", "state?s=test")).body, { status: "closed", revealIndex: 0 });
});

test("join validates the pseudo and returns a pid", async () => {
  const { call } = setup();
  assert.deepEqual(await call("POST", "join?s=test", { pseudo: "   " }), { status: 400, body: { error: "invalid_pseudo" } });
  const r = await call("POST", "join?s=test", { pseudo: "Token  Têtu", uid: UID });
  assert.deepEqual(r, { status: 200, body: { pid: "p1", pseudo: "Token Têtu", status: "closed" } });
  assert.equal((await call("POST", "join?s=test", "not json")).status, 400);
});

test("join refuses players beyond maxPlayers", async () => {
  const { call } = setup({ maxPlayers: 1 });
  assert.equal((await call("POST", "join?s=test", { pseudo: "Un" })).status, 200);
  assert.deepEqual(await call("POST", "join?s=test", { pseudo: "Deux" }), { status: 403, body: { error: "game_full" } });
});

test("answers are refused until the game is open", async () => {
  const { call } = setup();
  const { body } = await call("POST", "join?s=test", { pseudo: "Un" });
  const r = await call("POST", "answer?s=test", { pid: body.pid, qid: "q1", choice: "ai", confidence: 1 });
  assert.deepEqual(r, { status: 409, body: { error: "not_open" } });
});

test("answer validation", async () => {
  const { call, host } = setup();
  await host("open");
  const { body } = await call("POST", "join?s=test", { pseudo: "Un" });
  const answer = (patch) => call("POST", "answer?s=test", { pid: body.pid, qid: "q2", choice: "a", confidence: 2, ...patch });
  assert.deepEqual(await answer({ choice: "z" }), { status: 400, body: { error: "invalid_choice" } });
  assert.deepEqual(await answer({ confidence: 4 }), { status: 400, body: { error: "invalid_confidence" } });
  assert.deepEqual(await answer({ confidence: "2" }), { status: 400, body: { error: "invalid_confidence" } });
  assert.deepEqual(await answer({ qid: "qx" }), { status: 400, body: { error: "unknown_question" } });
  assert.deepEqual(await answer({ pid: "ghost" }), { status: 404, body: { error: "unknown_player" } });
  assert.deepEqual(await answer({}), { status: 200, body: { ok: true } });
  assert.deepEqual(await answer({ qid: "q5", choice: null }), { status: 200, body: { ok: true } });
});

test("game hides answers while open and reveals them with stats afterwards", async () => {
  const { call, host, play } = setup();
  await host("open");
  await play("Un", undefined, { q3: [2, 1] });
  const open = (await call("GET", "game?s=test")).body;
  assert.equal(open.state.status, "open");
  assert.ok(!("answer" in open.questions[3]) && !("explanation" in open.questions[3]));
  assert.ok(!("outputs" in open.questions[4]) && !("concept" in open.questions[4]));
  assert.ok(!("stats" in open));
  await host("reveal");
  const revealed = (await call("GET", "game?s=test")).body;
  assert.equal(revealed.questions[3].answer, 2);
  assert.equal(revealed.questions[3].conceptLabel, "Hallucination");
  assert.deepEqual(revealed.stats.q3, { counts: { 2: 1 }, answered: 1, correctRate: 1 });
});

test("answers are locked after the reveal", async () => {
  const { call, host } = setup();
  await host("open");
  const { body } = await call("POST", "join?s=test", { pseudo: "Un" });
  await host("reveal");
  const r = await call("POST", "answer?s=test", { pid: body.pid, qid: "q1", choice: "ai", confidence: 1 });
  assert.deepEqual(r, { status: 409, body: { error: "not_open" } });
});

test("me returns score, profile, badges and missed concepts after the reveal", async () => {
  const { call, host, play } = setup();
  await host("open");
  const pid = await play("Alice", UID, A);
  assert.deepEqual(await call("GET", `me?s=test&pid=${pid}`), { status: 409, body: { error: "not_revealed" } });
  await host("reveal");
  const { status, body } = await call("GET", `me?s=test&pid=${pid}`);
  assert.equal(status, 200);
  assert.equal(body.pseudo, "Alice");
  assert.equal(body.score, 57);
  assert.equal(body.correct, 2);
  assert.equal(body.answered, 3);
  assert.equal(body.profile.id, "oracle");
  assert.deepEqual(body.badges.map((b) => b.id), ["detector"]);
  assert.deepEqual(body.missedConcepts, ["Tokenisation"]);
  assert.deepEqual(body.progression, [{ session: "test", score: 57 }]);
  assert.deepEqual(body.answers.q3, { choice: 2, confidence: 1 });
  assert.equal((await call("GET", "me?s=test&pid=ghost")).status, 404);
});

test("isValidChoice per game", () => {
  const [q0, , q2, q3, q4] = fixtureGame.questions;
  assert.equal(isValidChoice(q0, "human"), true);
  assert.equal(isValidChoice(q0, "robot"), false);
  assert.equal(isValidChoice(q2, "b"), true);
  assert.equal(isValidChoice(q3, null), true);
  assert.equal(isValidChoice(q3, 2), true);
  assert.equal(isValidChoice(q3, 3), false);
  assert.equal(isValidChoice(q3, "2"), false);
  assert.equal(isValidChoice(q4, "a"), true);
  assert.equal(isValidChoice({ game: "nope" }, "a"), false);
});
```

Ces tests appellent `host("open")` et `host("reveal")`. La route `POST host` minimale (open/reveal) est donc implémentée dès cette tâche, et la tâche 6 la complète.

- [ ] **Step 4 : vérifier l'échec**

Run : `pnpm test`
Expected : FAIL, `Cannot find module '.../netlify/lib/quiz/api.mjs'`.

- [ ] **Step 5 : implémenter** `netlify/lib/quiz/api.mjs`

```js
import { createHash, timingSafeEqual } from "node:crypto";
import { badgesFor, profileFor } from "../../../quiz/lib/profiles.js";
import { cleanPseudo } from "../../../quiz/lib/pseudo.js";
import { aggregate, scorePlayer } from "../../../quiz/lib/scoring.js";

export const MAX_PLAYERS = 40;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVEALED = new Set(["reveal", "done"]);

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export function isValidChoice(question, choice) {
  switch (question.game) {
    case "human_or_ai":
      return choice === "human" || choice === "ai";
    case "bet_machine":
      return question.choices.some((c) => c.id === choice);
    case "investigation":
      return choice === null || (Number.isInteger(choice) && choice >= 0 && choice < question.transcript.length);
    case "prompt_duel":
      return question.prompts.some((p) => p.id === choice);
    default:
      return false;
  }
}

// Compare digests so the comparison is constant-time whatever the lengths.
function sameSecret(given, expected) {
  const digest = (v) => createHash("sha256").update(String(v)).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export function createApi({ store, content, hostKey, maxPlayers = MAX_PLAYERS, now = () => new Date(), newId = () => crypto.randomUUID() }) {
  const keys = {
    state: (s) => `games/${s}/state`,
    game: (s) => `games/${s}/`,
    players: (s) => `games/${s}/players/`,
    player: (s, pid) => `games/${s}/players/${pid}`,
    member: (uid) => `members/${uid}`,
  };

  async function readState(s) {
    return (await store.get(keys.state(s), { type: "json" })) ?? { status: "closed", revealIndex: 0 };
  }

  async function listPlayers(s) {
    const { blobs } = await store.list({ prefix: keys.players(s) });
    const players = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return players.filter(Boolean);
  }

  async function readBody(req) {
    try {
      return await req.json();
    } catch {
      throw new HttpError(400, "invalid_json");
    }
  }

  async function requirePlayer(s, pid) {
    if (typeof pid !== "string" || !pid) throw new HttpError(400, "invalid_player");
    const player = await store.get(keys.player(s, pid), { type: "json" });
    if (!player) throw new HttpError(404, "unknown_player");
    return player;
  }

  function requireHost(req) {
    if (!hostKey) throw new HttpError(503, "host_key_not_configured");
    const header = req.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!given || !sameSecret(given, hostKey)) throw new HttpError(401, "unauthorized");
  }

  const routes = {
    "GET game": async ({ s, game }) => {
      const state = await readState(s);
      const revealed = REVEALED.has(state.status);
      const body = { ...content.publicGame(game, { revealed }), state };
      if (revealed) body.stats = aggregate(game.questions, await listPlayers(s)).perQuestion;
      return body;
    },

    "GET state": async ({ s }) => readState(s),

    "POST join": async ({ s, req }) => {
      const { pseudo, uid } = await readBody(req);
      const clean = cleanPseudo(pseudo);
      if (!clean) throw new HttpError(400, "invalid_pseudo");
      const { blobs } = await store.list({ prefix: keys.players(s) });
      if (blobs.length >= maxPlayers) throw new HttpError(403, "game_full");
      const state = await readState(s);
      const pid = newId();
      await store.setJSON(keys.player(s, pid), {
        pid,
        pseudo: clean,
        uid: typeof uid === "string" && UUID_RE.test(uid) ? uid : null,
        joinedAt: now().toISOString(),
        answers: {},
      });
      return { pid, pseudo: clean, status: state.status };
    },

    "POST answer": async ({ s, game, req }) => {
      const { pid, qid, choice, confidence } = await readBody(req);
      const state = await readState(s);
      if (state.status !== "open") throw new HttpError(409, "not_open");
      const player = await requirePlayer(s, pid);
      const question = game.questions.find((q) => q.id === qid);
      if (!question) throw new HttpError(400, "unknown_question");
      if (![1, 2, 3].includes(confidence)) throw new HttpError(400, "invalid_confidence");
      if (!isValidChoice(question, choice)) throw new HttpError(400, "invalid_choice");
      player.answers[qid] = { choice, confidence };
      await store.setJSON(keys.player(s, pid), player);
      return { ok: true };
    },

    "GET me": async ({ s, game, url }) => {
      const state = await readState(s);
      if (!REVEALED.has(state.status)) throw new HttpError(409, "not_revealed");
      const player = await requirePlayer(s, url.searchParams.get("pid"));
      const result = scorePlayer(game.questions, player.answers);
      const previous = player.uid ? ((await store.get(keys.member(player.uid), { type: "json" })) ?? []).filter((e) => e.session !== s) : [];
      const progression = previous.map(({ session, score }) => ({ session, score }));
      if (result.score !== null) progression.push({ session: s, score: result.score });
      return {
        pseudo: player.pseudo,
        answers: player.answers,
        score: result.score,
        correct: result.correct,
        answered: result.answered,
        profile: profileFor(result),
        badges: badgesFor(game.questions, player.answers),
        missedConcepts: Object.entries(result.concepts)
          .filter(([, c]) => c.correct < c.answered)
          .map(([id]) => content.conceptLabel(id)),
        progression,
      };
    },

    "POST host": async ({ s, game, req }) => {
      requireHost(req);
      const { action } = await readBody(req);
      let next;
      switch (action) {
        case "open":
          next = { status: "open", revealIndex: 0 };
          break;
        case "reveal":
          next = { status: "reveal", revealIndex: 0 };
          break;
        default:
          throw new HttpError(400, "invalid_action");
      }
      await store.setJSON(keys.state(s), next);
      return next;
    },
  };

  return async function handle(req) {
    try {
      const url = new URL(req.url);
      const route = url.pathname.replace(/^\/api\/quiz\/?/, "").replace(/\/$/, "");
      const handler = routes[`${req.method} ${route}`];
      if (!handler) {
        const known = Object.keys(routes).some((k) => k.endsWith(` ${route}`));
        throw known ? new HttpError(405, "method_not_allowed") : new HttpError(404, "not_found");
      }
      const s = url.searchParams.get("s") ?? "";
      const game = content.getGame(s);
      if (!game) throw new HttpError(404, "unknown_session");
      return json(await handler({ s, game, req, url }));
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code }, err.status);
      console.error("[quiz-api]", err);
      return json({ error: "internal" }, 500);
    }
  };
}
```

- [ ] **Step 6 : vérifier le succès**

Run : `pnpm test`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add netlify/lib/quiz/api.mjs tests/helpers/ tests/quiz/api-player.test.mjs
git commit -m "feat(quiz): player API (join, answer, game, state, me)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : API animateur (pilotage, tableau de bord, fin de partie, export)

**Files :**
- Modify : `netlify/lib/quiz/api.mjs` (route `POST host` complétée, ajout de `GET host-state`, `GET export`, `recordMembers`)
- Create : `tests/quiz/api-host.test.mjs`

**Interfaces :**
- Consumes : `setup`, `UID`, `A`, `B` exportés par `tests/helpers/quiz-api.mjs` (Task 5) ; `compareWithHistory` (Task 4).
- Produces :
  - `POST host {action}` : `open` | `reveal` | `goto {index: 0..n}` (n = nombre de questions, index n = écran « Niveau du jour ») | `finish` (→ `done`, `revealIndex = n`, écrit `members/<uid>`) | `reset` (supprime `games/<s>/*`). Erreurs : `invalid_action` 400, `invalid_index` 400, `not_revealed` 409.
  - `GET host-state` → `{game (révélé), state, players: [{pseudo, answered}], stats, globalScore, concepts (avec previous), profiles: {[profileId]: n}}`
  - `GET export` (`done` requis, sinon `not_done` 409) → `{session, date: "YYYY-MM-DD", players, globalScore, concepts: {[id]: {asked, correctRate (2 déc.), avgConfidence (1 déc.)}}}`
  - Codes d'accès : `host_key_not_configured` 503, `unauthorized` 401.

- [ ] **Step 1 : tests qui échouent** (`tests/quiz/api-host.test.mjs`)

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { A, B, setup, UID } from "../helpers/quiz-api.mjs";

test("host routes require a configured, matching key", async () => {
  const { call } = setup();
  assert.deepEqual(await call("POST", "host?s=test", { action: "open" }), { status: 401, body: { error: "unauthorized" } });
  assert.deepEqual(await call("POST", "host?s=test", { action: "open" }, "wrong"), { status: 401, body: { error: "unauthorized" } });
  assert.equal((await call("GET", "host-state?s=test", undefined, "wrong")).status, 401);
  const unconfigured = setup({ hostKey: "" }); // an empty env var counts as unset
  assert.deepEqual(await unconfigured.call("POST", "host?s=test", { action: "open" }, "x"), { status: 503, body: { error: "host_key_not_configured" } });
});

test("host-state reports players, aggregates, history comparison and profiles", async () => {
  const { call, host, play } = setup();
  await host("open");
  await play("Alice", UID, A);
  await play("Bob", undefined, B);
  await host("reveal");
  const { status, body } = await call("GET", "host-state?s=test", undefined, "secret");
  assert.equal(status, 200);
  assert.deepEqual(body.players, [{ pseudo: "Alice", answered: 4 }, { pseudo: "Bob", answered: 3 }]);
  assert.equal(body.globalScore, 58);
  assert.equal(body.state.status, "reveal");
  assert.equal(body.game.questions[3].answer, 2);
  assert.equal(body.concepts.hallucination.correctRate, 1);
  assert.deepEqual(body.concepts.hallucination.previous, { session: "03", correctRate: 0.45 });
  assert.deepEqual(body.profiles, { oracle: 1, temeraire: 1 });
  assert.deepEqual(body.stats.q0.counts, { human: 1, ai: 1 });
});

test("goto is bounded and only works once revealed", async () => {
  const { host } = setup();
  await host("open");
  assert.deepEqual(await host("goto", { index: 1 }), { status: 409, body: { error: "not_revealed" } });
  await host("reveal");
  assert.deepEqual(await host("goto", { index: 99 }), { status: 400, body: { error: "invalid_index" } });
  assert.deepEqual(await host("goto", { index: -1 }), { status: 400, body: { error: "invalid_index" } });
  assert.deepEqual(await host("goto", { index: 7 }), { status: 200, body: { status: "reveal", revealIndex: 7 } });
  assert.deepEqual(await host("dance"), { status: 400, body: { error: "invalid_action" } });
});

test("finish records member progression for players with a local id", async () => {
  const { call, host, play, store } = setup();
  await store.setJSON(`members/${UID}`, [{ session: "04", score: 40, concepts: {} }]);
  await host("open");
  const pid = await play("Alice", UID, A);
  await play("Bob", undefined, B);
  assert.deepEqual(await host("finish"), { status: 409, body: { error: "not_revealed" } });
  await host("reveal");
  assert.deepEqual(await host("finish"), { status: 200, body: { status: "done", revealIndex: 7 } });
  const member = await store.get(`members/${UID}`, { type: "json" });
  assert.deepEqual(member.map((e) => [e.session, e.score]), [["04", 40], ["test", 57]]);
  const me = await call("GET", `me?s=test&pid=${pid}`);
  assert.deepEqual(me.body.progression, [{ session: "04", score: 40 }, { session: "test", score: 57 }]);
  await host("finish"); // idempotent: no duplicate entry
  assert.equal((await store.get(`members/${UID}`, { type: "json" })).length, 2);
});

test("export returns the aggregated history entry once the game is done", async () => {
  const { call, host, play } = setup();
  await host("open");
  await play("Alice", UID, A);
  await play("Bob", undefined, B);
  await host("reveal");
  assert.deepEqual(await call("GET", "export?s=test", undefined, "secret"), { status: 409, body: { error: "not_done" } });
  await host("finish");
  const { status, body } = await call("GET", "export?s=test", undefined, "secret");
  assert.equal(status, 200);
  assert.equal(body.session, "test");
  assert.equal(body.date, "2026-10-20");
  assert.equal(body.players, 2);
  assert.equal(body.globalScore, 58);
  assert.deepEqual(body.concepts.tokenization, { asked: 2, correctRate: 0, avgConfidence: 3 });
  assert.deepEqual(body.concepts.hallucination, { asked: 2, correctRate: 1, avgConfidence: 2 });
  assert.deepEqual(body.concepts["ai-detection"], { asked: 1, correctRate: 0.5, avgConfidence: 2.5 });
  assert.deepEqual(body.concepts["prompt-context"], { asked: 1, correctRate: null, avgConfidence: null });
});

test("reset clears players and state", async () => {
  const { call, host, play, store } = setup();
  await host("open");
  await play("Alice", UID, A);
  assert.deepEqual(await host("reset"), { status: 200, body: { status: "closed", revealIndex: 0 } });
  assert.deepEqual((await call("GET", "state?s=test")).body, { status: "closed", revealIndex: 0 });
  assert.deepEqual([...store.data.keys()].filter((k) => k.startsWith("games/test/")), []);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm test`
Expected : FAIL sur les nouveaux tests (`invalid_action` pour `goto`/`finish`/`reset`, 404 `not_found` pour `host-state`/`export`) ; les tests de la tâche 5 passent toujours.

- [ ] **Step 3 : implémenter** dans `netlify/lib/quiz/api.mjs`

Ajouter cet helper juste avant `function createApi(` :

```js
const round = (x, decimals) => (x === null ? null : Math.round(x * 10 ** decimals) / 10 ** decimals);
```

Ajouter dans `createApi`, après `requireHost` :

```js
  // Called on « finish »: one entry per session per anonymous local id, so a
  // returning player can see their own progression next time.
  async function recordMembers(s, game) {
    for (const player of await listPlayers(s)) {
      if (!player.uid) continue;
      const result = scorePlayer(game.questions, player.answers);
      if (result.score === null) continue;
      const entries = ((await store.get(keys.member(player.uid), { type: "json" })) ?? []).filter((e) => e.session !== s);
      entries.push({ session: s, score: result.score, concepts: result.concepts });
      await store.setJSON(keys.member(player.uid), entries);
    }
  }
```

Remplacer **toute** l'entrée `"POST host"` de `routes` par :

```js
    "POST host": async ({ s, game, req }) => {
      requireHost(req);
      const { action, index } = await readBody(req);
      const state = await readState(s);
      const last = game.questions.length; // index « last » = the « niveau du jour » screen
      let next;
      switch (action) {
        case "open":
          next = { status: "open", revealIndex: 0 };
          break;
        case "reveal":
          next = { status: "reveal", revealIndex: 0 };
          break;
        case "goto":
          if (!REVEALED.has(state.status)) throw new HttpError(409, "not_revealed");
          if (!Number.isInteger(index) || index < 0 || index > last) throw new HttpError(400, "invalid_index");
          next = { ...state, revealIndex: index };
          break;
        case "finish":
          if (!REVEALED.has(state.status)) throw new HttpError(409, "not_revealed");
          await recordMembers(s, game);
          next = { status: "done", revealIndex: last };
          break;
        case "reset": {
          const { blobs } = await store.list({ prefix: keys.game(s) });
          await Promise.all(blobs.map((b) => store.delete(b.key)));
          return { status: "closed", revealIndex: 0 };
        }
        default:
          throw new HttpError(400, "invalid_action");
      }
      await store.setJSON(keys.state(s), next);
      return next;
    },

    "GET host-state": async ({ s, game, req }) => {
      requireHost(req);
      const [state, players] = await Promise.all([readState(s), listPlayers(s)]);
      const agg = aggregate(game.questions, players);
      const profiles = {};
      for (const p of players) {
        const profile = profileFor(scorePlayer(game.questions, p.answers));
        if (profile) profiles[profile.id] = (profiles[profile.id] ?? 0) + 1;
      }
      return {
        game: content.publicGame(game, { revealed: true }),
        state,
        players: players
          .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
          .map((p) => ({ pseudo: p.pseudo, answered: Object.keys(p.answers).length })),
        stats: agg.perQuestion,
        globalScore: agg.globalScore,
        concepts: content.compareWithHistory(agg.concepts, s),
        profiles,
      };
    },

    "GET export": async ({ s, game, req }) => {
      requireHost(req);
      const state = await readState(s);
      if (state.status !== "done") throw new HttpError(409, "not_done");
      const players = await listPlayers(s);
      const agg = aggregate(game.questions, players);
      const concepts = {};
      for (const [id, c] of Object.entries(agg.concepts)) {
        concepts[id] = { asked: c.asked, correctRate: round(c.correctRate, 2), avgConfidence: round(c.avgConfidence, 1) };
      }
      return { session: s, date: now().toISOString().slice(0, 10), players: players.length, globalScore: agg.globalScore, concepts };
    },
```

- [ ] **Step 4 : vérifier le succès**

Run : `pnpm test`
Expected : PASS (tous les fichiers).

- [ ] **Step 5 : commit**

```bash
git add netlify/lib/quiz/api.mjs tests/quiz/api-host.test.mjs
git commit -m "feat(quiz): host API (navigation, dashboard, finish, export, reset)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : fonction Netlify, configuration et simulation de bout en bout

**Files :**
- Create : `netlify/functions/quiz-api.mjs`, `scripts/quiz-simulate.mjs`
- Modify : `netlify.toml`, `.env.example`

**Interfaces :**
- Consumes : `createApi` (Tasks 5–6), `content` (Task 4).
- Produces : endpoint `/api/quiz/*` en local (`netlify dev`, port 8888) et en production ; script `pnpm quiz:simulate [session] [--url …]`.

- [ ] **Step 1 : fonction** `netlify/functions/quiz-api.mjs`

```js
import { getStore } from "@netlify/blobs";
import { createApi } from "../lib/quiz/api.mjs";
import { content } from "../lib/quiz/content.mjs";

// Thin Netlify wiring: everything testable lives in netlify/lib/quiz/.
export default async (req) => {
  const api = createApi({
    store: getStore({ name: "quiz", consistency: "strong" }),
    content,
    hostKey: process.env.QUIZ_HOST_KEY,
  });
  return api(req);
};

export const config = { path: "/api/quiz/*" };
```

- [ ] **Step 2 : `netlify.toml`** (ajouter à la fin du fichier)

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# The site publishes the repo root: never serve quiz answers or tooling.
[[redirects]]
  from = "/quiz-data/*"
  to = "/404"
  status = 404
  force = true

[[redirects]]
  from = "/node_modules/*"
  to = "/404"
  status = 404
  force = true

[[redirects]]
  from = "/netlify/*"
  to = "/404"
  status = 404
  force = true

[[redirects]]
  from = "/tests/*"
  to = "/404"
  status = 404
  force = true
```

- [ ] **Step 3 : `.env.example`** (ajouter à la fin du fichier)

```
# Quiz brise-glace: host screen key (also set it in Netlify → Site configuration → Environment variables)
QUIZ_HOST_KEY=change-me-long-random-string
# Base URL used by scripts/quiz-export.mjs and scripts/quiz-simulate.mjs
QUIZ_BASE_URL=http://localhost:8888
```

- [ ] **Step 4 : script de simulation** `scripts/quiz-simulate.mjs`

```js
#!/usr/bin/env node
// Plays a full game against a running site with 3 fake players.
// QUIZ_HOST_KEY=… node scripts/quiz-simulate.mjs [session] [--url http://localhost:8888]
// ⚠️ Starts with a « reset »: never run it against a real session in progress.
const args = process.argv.slice(2);
const urlAt = args.indexOf("--url");
const base = (urlAt >= 0 ? args[urlAt + 1] : process.env.QUIZ_BASE_URL) ?? "http://localhost:8888";
const session = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--url") ?? "demo";
const key = process.env.QUIZ_HOST_KEY;
if (!key) {
  console.error("QUIZ_HOST_KEY manquante");
  process.exit(1);
}

async function call(method, path, body, auth = false) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}/api/quiz/${path}${sep}s=${encodeURIComponent(session)}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(auth ? { authorization: `Bearer ${key}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.error}`);
  return data;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
function randomChoice(q) {
  switch (q.game) {
    case "human_or_ai":
      return pick(["human", "ai"]);
    case "bet_machine":
      return pick(q.choices).id;
    case "investigation":
      return pick([null, ...q.transcript.flatMap((line, i) => (line.role === "ai" ? [i] : []))]);
    case "prompt_duel":
      return pick(q.prompts).id;
  }
}

await call("POST", "host", { action: "reset" }, true);
await call("POST", "host", { action: "open" }, true);
const game = await call("GET", "game");
if (game.questions.some((q) => "answer" in q)) throw new Error("Fuite : réponses visibles avant la révélation");

const pids = [];
for (const pseudo of ["Sim Alpha", "Sim Bêta", "Sim Gamma"]) {
  const { pid } = await call("POST", "join", { pseudo, uid: crypto.randomUUID() });
  for (const q of game.questions) {
    await call("POST", "answer", { pid, qid: q.id, choice: randomChoice(q), confidence: 1 + Math.floor(Math.random() * 3) });
  }
  pids.push(pid);
}

await call("POST", "host", { action: "reveal" }, true);
for (const pid of pids) {
  const me = await call("GET", `me?pid=${encodeURIComponent(pid)}`);
  console.log(`${me.pseudo} : ${me.score}/100 — ${me.profile?.emoji} ${me.profile?.title}`);
}
const dashboard = await call("GET", "host-state", undefined, true);
console.log(`Niveau du jour : ${dashboard.globalScore}/100 (${dashboard.players.length} joueurs)`);
await call("POST", "host", { action: "finish" }, true);
console.log(JSON.stringify(await call("GET", "export", undefined, true), null, 2));
console.log("✅ Simulation terminée");
```

- [ ] **Step 5 : lancer en local et simuler**

Créer un `.env` local (ignoré par git) avec `QUIZ_HOST_KEY=dev-key`.

Run (terminal 1) : `pnpm dev`
Expected : `netlify dev` écoute sur `http://localhost:8888` et liste la fonction `quiz-api`. Si une erreur Blobs mentionne un site non lié, lancer `pnpm --package=netlify-cli@27 dlx netlify link` une fois, puis relancer.

Run (terminal 2) : `QUIZ_HOST_KEY=dev-key pnpm quiz:simulate demo`
Expected : 3 lignes `Sim … : NN/100 — <profil>`, `Niveau du jour : NN/100 (3 joueurs)`, un JSON d'export avec `"session": "demo"`, puis `✅ Simulation terminée`.

Run : `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8888/quiz-data/sessions/demo.json`
Expected : `404`.

- [ ] **Step 6 : commit**

```bash
git add netlify/functions/quiz-api.mjs netlify.toml .env.example scripts/quiz-simulate.mjs
git commit -m "feat(quiz): Netlify function wiring, private quiz-data and e2e simulation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : briques front partagées et modules de jeux

**Files :**
- Create : `quiz/lib/dom.js`, `quiz/lib/api.js`, `quiz/lib/media.js`, `quiz/lib/games/common.js`, `quiz/lib/games/human-or-ai.js`, `quiz/lib/games/bet-machine.js`, `quiz/lib/games/investigation.js`, `quiz/lib/games/prompt-duel.js`, `quiz/lib/games/index.js`, `quiz/quiz.css`

**Interfaces :**
- Consumes : `choiceKey` (Task 2) ; routes API (Tasks 5–6).
- Produces :
  - `h(tag, attrs, ...children) -> HTMLElement` (le texte passe toujours par des nœuds texte, jamais par du HTML), `mount(root, ...nodes)`
  - `api.{game(s), state(s), join(s, pseudo, uid), answer(s, pid, qid, choice, confidence), me(s, pid), hostState(s, key), host(s, key, action, extra)}` qui lèvent `ApiError {status, code}` ; `poll(fn, ms) -> stop()`
  - `renderMedia(media) -> HTMLElement|null`
  - `GAMES[gameId].renderQuestion(q, onPick(choice)) -> HTMLElement` et `GAMES[gameId].renderReveal(q, stats|undefined, mine|undefined) -> HTMLElement`, où `stats = {counts, answered, correctRate}` et `mine = {choice, confidence}`
  - `confidencePicker(onPick(1|2|3)) -> HTMLElement`

- [ ] **Step 1 : `quiz/lib/dom.js`**

```js
// Tiny DOM builder. Children are appended as text nodes, never parsed as HTML,
// so content from quiz files or pseudos cannot inject markup.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith("on") && typeof value === "function") el.addEventListener(name.slice(2).toLowerCase(), value);
    else if (name === "class") el.className = value;
    else el.setAttribute(name, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function mount(root, ...nodes) {
  root.replaceChildren(...nodes.flat().filter(Boolean));
}
```

- [ ] **Step 2 : `quiz/lib/api.js`**

```js
const BASE = "/api/quiz";

export class ApiError extends Error {
  constructor(status, code) {
    super(`${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, key } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "network");
  return data;
}

const qs = (s, extra = "") => `?s=${encodeURIComponent(s)}${extra}`;

export const api = {
  game: (s) => request(`/game${qs(s)}`),
  state: (s) => request(`/state${qs(s)}`),
  join: (s, pseudo, uid) => request(`/join${qs(s)}`, { method: "POST", body: { pseudo, uid } }),
  answer: (s, pid, qid, choice, confidence) => request(`/answer${qs(s)}`, { method: "POST", body: { pid, qid, choice, confidence } }),
  me: (s, pid) => request(`/me${qs(s, `&pid=${encodeURIComponent(pid)}`)}`),
  hostState: (s, key) => request(`/host-state${qs(s)}`, { key }),
  host: (s, key, action, extra = {}) => request(`/host${qs(s)}`, { method: "POST", key, body: { action, ...extra } }),
};

// Calls fn every `ms` milliseconds, never overlapping; errors are logged and retried.
export function poll(fn, ms) {
  let stopped = false;
  let timer;
  const tick = async () => {
    if (stopped) return;
    try {
      await fn();
    } catch (err) {
      console.warn("[quiz] poll", err);
    }
    if (!stopped) timer = setTimeout(tick, ms);
  };
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
```

- [ ] **Step 3 : `quiz/lib/media.js`**

```js
import { h } from "./dom.js";

export function renderMedia(media) {
  if (!media) return null;
  switch (media.kind) {
    case "text":
      return h("blockquote", { class: "media media-text" }, media.text);
    case "code":
      return h("pre", { class: "media media-code" }, h("code", {}, media.text));
    case "image":
      return h("img", { class: "media media-image", src: media.src, alt: media.alt ?? "" });
    case "video":
      return renderVideo(media);
    default:
      return h("p", { class: "error" }, "Média non pris en charge.");
  }
}

function renderVideo(media) {
  if (media.src) {
    return h("video", { class: "media media-video", src: media.src, controls: true, playsinline: true, preload: "metadata" });
  }
  const start = media.start ?? 0;
  const src =
    media.provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.id)}?start=${start}${media.end ? `&end=${media.end}` : ""}&rel=0&playsinline=1`
      : `https://player.vimeo.com/video/${encodeURIComponent(media.id)}#t=${start}s`;
  return h(
    "div",
    { class: "media-video-wrap" },
    h("iframe", { class: "media media-video", src, title: "Vidéo", loading: "lazy", allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true }),
    media.fallback ? h("a", { class: "media-fallback", href: media.fallback, target: "_blank", rel: "noopener" }, "La vidéo ne se charge pas ? Voir l'image") : null,
  );
}
```

- [ ] **Step 4 : `quiz/lib/games/common.js`**

```js
import { h } from "../dom.js";
import { choiceKey } from "../scoring.js";

export const CONFIDENCE = [
  { value: 1, label: "Je pense" },
  { value: 2, label: "Je suis sûr" },
  { value: 3, label: "Certain" },
];

const percent = (n, total) => (total ? Math.round((n * 100) / total) : 0);

export function choiceButtons(options, onPick) {
  return h(
    "div",
    { class: "choices" },
    options.map((o) => h("button", { class: "choice", type: "button", onclick: () => onPick(o.value) }, o.label)),
  );
}

export function confidencePicker(onPick) {
  return h(
    "div",
    { class: "confidence" },
    h("p", { class: "kicker" }, "Ton niveau de confiance ?"),
    h("div", { class: "choices choices-row" }, CONFIDENCE.map((c) => h("button", { class: "choice", type: "button", onclick: () => onPick(c.value) }, c.label))),
  );
}

export function revealBars(options, q, stats, mine) {
  const total = stats?.answered ?? 0;
  return h(
    "ul",
    { class: "bars" },
    options.map((o) => {
      const pct = percent(stats?.counts?.[choiceKey(o.value)] ?? 0, total);
      const correct = o.value === q.answer;
      const isMine = mine?.choice === o.value;
      return h(
        "li",
        { class: `bar${correct ? " is-correct" : ""}${isMine ? " is-mine" : ""}` },
        h("span", { class: "bar-label" }, `${correct ? "✅ " : ""}${o.label}${isMine ? " · toi" : ""}`),
        h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${pct}%` })),
        h("span", { class: "bar-pct" }, `${pct} %`),
      );
    }),
  );
}

export function verdict(q, mine) {
  if (!mine) return null;
  const ok = mine.choice === q.answer;
  return h("p", { class: `verdict ${ok ? "ok" : "ko"}` }, ok ? "✅ Bien vu !" : "❌ Raté !");
}

export function explanation(q) {
  return h("div", { class: "explain" }, h("p", { class: "kicker" }, q.conceptLabel ?? q.concept), h("p", {}, q.explanation));
}

export { percent };
```

- [ ] **Step 5 : les quatre modules de jeu**

`quiz/lib/games/human-or-ai.js` :

```js
import { h } from "../dom.js";
import { renderMedia } from "../media.js";
import { choiceButtons, explanation, revealBars, verdict } from "./common.js";

const OPTIONS = [
  { value: "human", label: "🧑 Humain" },
  { value: "ai", label: "🤖 IA" },
];
const title = (q) => (q.warmup ? "Échauffement : humain ou IA ?" : "Humain ou IA ?");

export function renderQuestion(q, onPick) {
  return h("div", { class: "q" }, h("p", { class: "q-title" }, title(q)), renderMedia(q.media), choiceButtons(OPTIONS, onPick));
}

export function renderReveal(q, stats, mine) {
  return h("div", { class: "q" }, h("p", { class: "q-title" }, title(q)), renderMedia(q.media), verdict(q, mine), revealBars(OPTIONS, q, stats, mine), explanation(q));
}
```

`quiz/lib/games/bet-machine.js` :

```js
import { h } from "../dom.js";
import { renderMedia } from "../media.js";
import { choiceButtons, explanation, revealBars, verdict } from "./common.js";

const options = (q) => q.choices.map((c) => ({ value: c.id, label: c.text }));

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "Pariez sur la machine"),
    h("p", { class: "lead" }, q.prompt),
    renderMedia(q.media),
    h("p", {}, "Que va faire le modèle ?"),
    choiceButtons(options(q), onPick),
  );
}

export function renderReveal(q, stats, mine) {
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "Pariez sur la machine"),
    h("p", { class: "lead" }, q.prompt),
    verdict(q, mine),
    revealBars(options(q), q, stats, mine),
    explanation(q),
  );
}
```

`quiz/lib/games/investigation.js` :

```js
import { h } from "../dom.js";
import { explanation, verdict } from "./common.js";

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "L'Enquête : trouve ce qui cloche"),
    h("p", { class: "lead" }, "Touche la réponse de l'IA qui pose problème."),
    h(
      "ol",
      { class: "transcript" },
      q.transcript.map((line, i) =>
        h(
          "li",
          { class: "bubble-row" },
          line.role === "ai"
            ? h("button", { class: "bubble ai", type: "button", onclick: () => onPick(i) }, line.text)
            : h("div", { class: "bubble user" }, line.text),
        ),
      ),
    ),
    h("button", { class: "choice", type: "button", onclick: () => onPick(null) }, "🤷 Rien ne cloche"),
  );
}

export function renderReveal(q, stats, mine) {
  const count = (key) => stats?.counts?.[key] ?? 0;
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "L'Enquête"),
    verdict(q, mine),
    h(
      "ol",
      { class: "transcript" },
      q.transcript.map((line, i) =>
        h(
          "li",
          { class: "bubble-row" },
          h(
            "div",
            { class: `bubble ${line.role}${i === q.answer ? " is-faulty" : ""}${mine?.choice === i ? " is-mine" : ""}` },
            line.text,
            line.role === "ai" ? h("span", { class: "bubble-count" }, `${count(String(i))} 👆`) : null,
          ),
        ),
      ),
    ),
    h("p", { class: q.answer === null ? "none-line is-correct" : "none-line" }, `${q.answer === null ? "✅ " : ""}Rien ne cloche : ${count("none")} 👆`),
    explanation(q),
  );
}
```

`quiz/lib/games/prompt-duel.js` :

```js
import { h } from "../dom.js";
import { explanation, percent, verdict } from "./common.js";

const label = (i) => `Prompt ${String.fromCharCode(65 + i)}`;

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "Duel de prompts"),
    h("p", { class: "lead" }, q.task),
    h("p", {}, "Quel prompt donnera le meilleur résultat ?"),
    h(
      "div",
      { class: "choices" },
      q.prompts.map((p, i) =>
        h("button", { class: "choice prompt-card", type: "button", onclick: () => onPick(p.id) }, h("span", { class: "kicker" }, label(i)), h("pre", {}, p.text)),
      ),
    ),
  );
}

export function renderReveal(q, stats, mine) {
  const total = stats?.answered ?? 0;
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "Duel de prompts"),
    h("p", { class: "lead" }, q.task),
    verdict(q, mine),
    h(
      "div",
      { class: "choices" },
      q.prompts.map((p, i) => {
        const pct = percent(stats?.counts?.[p.id] ?? 0, total);
        const correct = p.id === q.answer;
        return h(
          "div",
          { class: `choice prompt-card${correct ? " is-correct" : ""}` },
          h("span", { class: "kicker" }, `${correct ? "✅ " : ""}${label(i)} · ${pct} %${mine?.choice === p.id ? " · toi" : ""}`),
          h("pre", {}, p.text),
          h("span", { class: "kicker" }, "Résultat obtenu"),
          h("p", { class: "output" }, q.outputs[p.id]),
        );
      }),
    ),
    explanation(q),
  );
}
```

`quiz/lib/games/index.js` :

```js
import * as betMachine from "./bet-machine.js";
import * as humanOrAi from "./human-or-ai.js";
import * as investigation from "./investigation.js";
import * as promptDuel from "./prompt-duel.js";

// Adding a game: one module here + a schema in validate.mjs + a rule in isValidChoice.
export const GAMES = {
  human_or_ai: humanOrAi,
  bet_machine: betMachine,
  investigation,
  prompt_duel: promptDuel,
};
```

- [ ] **Step 6 : `quiz/quiz.css`**

```css
/* Quiz brise-glace — player (mobile first) and host screens.
   Colours and fonts come from design/tokens.css; never redeclare them here. */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-weight: 300; font-size: 17px; line-height: 1.5; -webkit-text-size-adjust: 100%; }
.app { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; min-height: 100dvh; }
.screen { display: flex; flex-direction: column; gap: 16px; }
.screen.center { text-align: center; align-items: center; justify-content: center; min-height: 70dvh; }
h1 { font-family: var(--serif); font-weight: 400; font-size: clamp(34px, 9vw, 52px); line-height: 1; letter-spacing: -0.02em; margin: 0; }
.lead { font-family: var(--serif); font-size: 22px; line-height: 1.3; color: var(--ink-2); margin: 0; }
.kicker { font-family: var(--mono); font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-3); margin: 0; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--ink-2); }
.input { font: inherit; font-size: 20px; padding: 14px 16px; border: 1px solid var(--rule-2); border-radius: 14px; background: var(--paper-3); color: var(--ink); width: 100%; }
.cta, .choice, .btn { font: inherit; font-weight: 500; border-radius: 999px; padding: 14px 20px; border: 1px solid var(--rule-2); background: var(--paper-3); color: var(--ink); cursor: pointer; min-height: 48px; }
.cta { background: var(--accent); border-color: var(--accent); color: var(--paper); font-size: 18px; }
.cta:disabled { opacity: 0.5; }
.link { font: inherit; background: none; border: none; color: var(--ink-2); text-decoration: underline; cursor: pointer; padding: 8px 0; align-self: flex-start; }
.error { color: var(--accent); margin: 0; }
.choices { display: flex; flex-direction: column; gap: 10px; }
.choice { text-align: left; border-radius: 14px; }
.choice:focus-visible, .choice:active { border-color: var(--accent); outline: none; }
.choices-row { flex-direction: row; flex-wrap: wrap; }
.choices-row .choice { flex: 1 1 30%; text-align: center; }
.q { display: flex; flex-direction: column; gap: 14px; }
.q-title { font-family: var(--serif); font-size: 28px; line-height: 1.1; margin: 0; }
.confidence { display: flex; flex-direction: column; gap: 10px; }

.media { width: 100%; margin: 0; border-radius: 14px; background: var(--paper-2); }
.media-text { font-family: var(--serif); font-size: 20px; padding: 18px; border-left: 3px solid var(--accent); white-space: pre-line; }
.media-code { font-family: var(--mono); font-size: 13px; padding: 14px; overflow-x: auto; }
.media-image { display: block; height: auto; }
.media-video-wrap { display: flex; flex-direction: column; gap: 6px; }
iframe.media-video { display: block; aspect-ratio: 16 / 9; height: auto; border: 0; }
video.media-video { display: block; }
.media-fallback { font-size: 14px; color: var(--ink-2); }

.transcript { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.bubble-row { display: flex; flex-direction: column; }
.bubble { max-width: 85%; padding: 10px 14px; border-radius: 16px; font: inherit; text-align: left; border: 1px solid var(--rule); color: inherit; }
.bubble.user { align-self: flex-end; background: var(--paper-2); }
.bubble.ai { align-self: flex-start; background: var(--paper-3); }
button.bubble { cursor: pointer; }
button.bubble:focus-visible, button.bubble:active { border-color: var(--accent); outline: none; }
.bubble.is-faulty { border: 2px solid var(--accent); }
.bubble.is-mine { box-shadow: 0 0 0 3px var(--accent-soft); }
.bubble-count { font-family: var(--mono); font-size: 12px; color: var(--ink-3); margin-left: 8px; }
.none-line { margin: 0; color: var(--ink-2); }
.none-line.is-correct { color: var(--accent); }

.prompt-card { display: flex; flex-direction: column; gap: 6px; }
.prompt-card pre, .output { font-family: var(--mono); font-size: 13px; white-space: pre-wrap; margin: 0; }
.output { background: var(--paper-2); padding: 10px; border-radius: 8px; }
.prompt-card.is-correct { border: 2px solid var(--accent); }

.bars { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.bar { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px 12px; }
.bar-label { grid-column: 1 / -1; }
.bar-track { height: 10px; border-radius: 999px; background: var(--paper-2); overflow: hidden; }
.bar-fill { display: block; height: 100%; background: var(--ink-3); }
.bar.is-correct .bar-fill { background: var(--accent); }
.bar.is-mine .bar-label { font-weight: 600; }
.bar-pct { font-family: var(--mono); font-size: 13px; color: var(--ink-2); }
.verdict { font-family: var(--serif); font-size: 24px; margin: 0; }
.explain { border-top: 1px solid var(--rule); padding-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.explain p { margin: 0; }

.profile-emoji { font-size: 64px; margin: 0; }
.score { font-family: var(--serif); font-size: 28px; margin: 0; }
.score strong { font-size: 64px; font-weight: 400; color: var(--accent); }
.badges, .revise { margin: 0; color: var(--ink-2); }
.progression ul { list-style: none; padding: 0; margin: 6px 0 0; }

/* Host screen (shared in Meet, 16:9) */
.host { display: grid; grid-template-columns: 1fr 300px; grid-template-rows: auto 1fr; gap: 24px 32px; max-width: none; padding: 32px 48px; }
.host #head { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; flex-wrap: wrap; border-bottom: 1px solid var(--rule); padding-bottom: 16px; }
.controls { display: flex; gap: 8px; flex-wrap: wrap; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--paper); }
.btn.ghost { background: none; cursor: default; }
.btn.danger { color: var(--ink-3); }
.host #main { font-size: 22px; }
.host #main .q-title { font-size: 48px; }
.qr { display: flex; gap: 48px; align-items: center; flex-wrap: wrap; }
.qr-code svg { display: block; width: min(56vh, 100%); height: auto; background: var(--paper-3); }
.qr-url { font-family: var(--mono); font-size: 28px; word-break: break-all; margin: 0; }
.players { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 10px; }
.player { display: grid; grid-template-columns: 1fr auto; gap: 4px; font-size: 16px; }
.player .bar-track { grid-column: 1 / -1; }
.summary-score { font-family: var(--serif); font-size: 160px; line-height: 0.9; color: var(--accent); margin: 0; }
.concepts { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; }
.concept-prev { grid-column: 1 / -1; font-family: var(--mono); font-size: 14px; color: var(--ink-3); }
.profiles { display: flex; gap: 16px; flex-wrap: wrap; list-style: none; padding: 0; margin: 0; }
@media (max-width: 900px) { .host { grid-template-columns: 1fr; padding: 16px; } }
```

- [ ] **Step 7 : vérifier que rien ne casse**

Run : `pnpm test`
Expected : PASS. Aucun test front ici : les modules DOM sont vérifiés manuellement aux tâches 9 et 10.

Run : `node --input-type=module -e "await import('./quiz/lib/scoring.js'); console.log('ok')"`
Expected : `ok`.

- [ ] **Step 8 : commit**

```bash
git add quiz/lib/ quiz/quiz.css
git commit -m "feat(quiz): front building blocks and the four game modules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : app joueur

**Files :**
- Create : `quiz/index.html`, `quiz/app.js`

**Interfaces :**
- Consumes : `api`, `poll` (Task 8) ; `h`, `mount` ; `GAMES`, `confidencePicker` ; `randomPseudo`, `MAX_PSEUDO_LENGTH` (Task 3).
- Produces : page `/quiz/?s=<session>`. Clés `localStorage` : `aic-quiz-uid` (UUID anonyme persistant) et `aic-quiz-<session>` (`{pid, pseudo, answers: {qid: {choice, confidence, sent}}}`).

- [ ] **Step 1 : `quiz/index.html`**

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brise-glace · AI Coffee</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../design/tokens.css">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="quiz.css">
<script type="module" src="app.js"></script>
</head>
<body>
<main id="app" class="app"><p class="lead">Chargement…</p></main>
</body>
</html>
```

- [ ] **Step 2 : `quiz/app.js`**

```js
import { api, poll } from "./lib/api.js";
import { h, mount } from "./lib/dom.js";
import { confidencePicker } from "./lib/games/common.js";
import { GAMES } from "./lib/games/index.js";
import { MAX_PSEUDO_LENGTH, randomPseudo } from "./lib/pseudo.js";

const root = document.getElementById("app");
const session = new URLSearchParams(location.search).get("s");
const STORE_KEY = `aic-quiz-${session}`;
const UID_KEY = "aic-quiz-uid";
const REVEALED = new Set(["reveal", "done"]);

// localStorage can throw (private mode, blocked storage): the game must still work.
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* state stays in memory for this tab */
  }
}
function uid() {
  let id = read(UID_KEY, null);
  if (!id) {
    id = crypto.randomUUID();
    write(UID_KEY, id);
  }
  return id;
}

const blank = () => ({ pid: null, pseudo: null, answers: {} });
let me = read(STORE_KEY, blank());
let game = null;
let state = null;
let results = null;
const save = () => write(STORE_KEY, me);
const allAnswered = () => game.questions.every((q) => me.answers[q.id]);

function message(title, text) {
  mount(root, h("section", { class: "screen center" }, h("h1", {}, title), text ? h("p", { class: "lead" }, text) : null));
}

async function main() {
  if (!session) return message("Lien incomplet", "Scanne le QR code affiché par l'animateur.");
  try {
    game = await api.game(session);
  } catch (err) {
    return message(err.status === 404 ? "Partie introuvable" : "Connexion impossible", "Vérifie le lien puis recharge la page.");
  }
  state = game.state;
  if (!me.pid && !REVEALED.has(state.status)) renderJoin();
  else render();
  poll(refresh, 3000);
}

async function refresh() {
  const next = await api.state(session);
  const previous = state;
  const statusChanged = next.status !== previous.status;
  if (statusChanged) {
    game = await api.game(session); // answers and stats arrive with the reveal
    results = null;
    if (next.status === "closed") {
      me = blank(); // the host reset the game
      save();
    }
  }
  state = next;
  if (state.status === "open") flushUnsent();
  if (!statusChanged && next.revealIndex === previous.revealIndex) return;
  if (!me.pid && !REVEALED.has(state.status)) {
    // back from a reveal, or the host reset the game: show the join screen again;
    // otherwise keep it as is (and what the player is typing)
    if (REVEALED.has(previous.status) || next.status === "closed") renderJoin();
    return;
  }
  render();
}

function render() {
  if (state.status === "closed") return message("La partie va commencer…", `Tu joues en tant que ${me.pseudo}. Garde cette page ouverte.`);
  if (state.status === "open") return renderPlay();
  return renderReveal();
}

function renderJoin() {
  const input = h("input", { class: "input", value: randomPseudo(), maxlength: MAX_PSEUDO_LENGTH, autocomplete: "off" });
  const error = h("p", { class: "error", role: "alert" });
  const go = h("button", { class: "cta", type: "button" }, "Jouer");
  go.addEventListener("click", async () => {
    go.disabled = true;
    error.textContent = "";
    try {
      const res = await api.join(session, input.value, uid());
      me = { pid: res.pid, pseudo: res.pseudo, answers: {} };
      save();
      render();
    } catch (err) {
      error.textContent =
        err.code === "game_full" ? "La partie est complète." : err.code === "invalid_pseudo" ? "Choisis un pseudo." : "Connexion impossible, réessaie.";
      go.disabled = false;
    }
  });
  mount(
    root,
    h(
      "section",
      { class: "screen" },
      h("p", { class: "kicker" }, "AI Coffee · Brise-glace"),
      h("h1", {}, game.title),
      h("label", { class: "field" }, "Ton pseudo", input),
      h("button", { class: "link", type: "button", onclick: () => (input.value = randomPseudo()) }, "🎲 Un autre pseudo"),
      go,
      error,
    ),
  );
}

function renderPlay() {
  const next = game.questions.find((q) => !me.answers[q.id]);
  if (!next) return renderWaiting();
  const index = game.questions.indexOf(next);
  const stage = h("div", { class: "stage" });
  stage.append(
    GAMES[next.game].renderQuestion(next, (choice) => {
      mount(
        stage,
        h(
          "div",
          { class: "screen" },
          h("p", { class: "lead" }, "Réponse choisie."),
          confidencePicker((confidence) => record(next.id, choice, confidence)),
          h("button", { class: "link", type: "button", onclick: renderPlay }, "↩ Changer de réponse"),
        ),
      );
    }),
  );
  mount(root, h("section", { class: "screen" }, h("p", { class: "kicker" }, `Question ${index + 1} / ${game.questions.length}`), stage));
}

function record(qid, choice, confidence) {
  me.answers[qid] = { choice, confidence, sent: false };
  save();
  renderPlay();
  send(qid);
}

async function send(qid) {
  const answer = me.answers[qid];
  try {
    await api.answer(session, me.pid, qid, answer.choice, answer.confidence);
    answer.sent = true;
    save();
  } catch (err) {
    if (err.code === "unknown_player") {
      me = blank(); // game was reset while we were away
      save();
      return renderJoin();
    }
    if (err.code !== "not_open") console.warn("[quiz] réponse non envoyée, nouvel essai au prochain cycle", err);
  }
  if (state.status === "open" && allAnswered()) renderWaiting();
}

function flushUnsent() {
  for (const [qid, answer] of Object.entries(me.answers)) if (!answer.sent) send(qid);
}

function renderWaiting() {
  const unsent = Object.values(me.answers).filter((a) => !a.sent).length;
  mount(
    root,
    h(
      "section",
      { class: "screen center" },
      h("h1", {}, "C'est dans la boîte ☕"),
      h("p", { class: "lead" }, "En attente de la révélation…"),
      unsent ? h("p", { class: "error" }, `${unsent} réponse(s) pas encore envoyée(s), nouvel essai automatique.`) : null,
    ),
  );
}

async function loadResults() {
  if (!me.pid) return null;
  if (!results) {
    try {
      results = await api.me(session, me.pid);
    } catch (err) {
      console.warn("[quiz] résultats indisponibles", err);
    }
  }
  return results;
}

async function renderReveal() {
  const r = await loadResults();
  const i = state.revealIndex;
  if (i >= game.questions.length) return renderProfile(r);
  const q = game.questions[i];
  mount(
    root,
    h(
      "section",
      { class: "screen" },
      h("p", { class: "kicker" }, `Révélation · ${i + 1} / ${game.questions.length}`),
      GAMES[q.game].renderReveal(q, game.stats?.[q.id], r?.answers?.[q.id]),
    ),
  );
}

function renderProfile(r) {
  if (!r || r.score === null) return message("Merci d'avoir suivi !", "Pas de réponse comptée cette fois. À la prochaine session !");
  const p = r.profile;
  mount(
    root,
    h(
      "section",
      { class: "screen center" },
      h("p", { class: "kicker" }, r.pseudo),
      h("p", { class: "profile-emoji" }, p.emoji),
      h("h1", {}, p.title),
      h("p", { class: "lead" }, p.tagline),
      h("p", { class: "score" }, h("strong", {}, String(r.score)), " / 100"),
      h("p", {}, `${r.correct} bonne(s) réponse(s) sur ${r.answered}`),
      r.badges.length ? h("p", { class: "badges" }, r.badges.map((b) => `${b.emoji} ${b.title}`).join(" · ")) : null,
      r.missedConcepts.length ? h("p", { class: "revise" }, `À revoir : ${r.missedConcepts.join(", ")}`) : null,
      r.progression.length > 1
        ? h(
            "div",
            { class: "progression" },
            h("p", { class: "kicker" }, "Ta progression"),
            h("ul", {}, r.progression.map((x) => h("li", {}, `Session ${x.session} : ${x.score}/100`))),
          )
        : null,
    ),
  );
}

main();
```

- [ ] **Step 3 : vérification manuelle (mobile)**

Avec `pnpm dev` lancé et `.env` contenant `QUIZ_HOST_KEY=dev-key` :

```bash
curl -s -X POST "http://localhost:8888/api/quiz/host?s=demo" -H "authorization: Bearer dev-key" -H "content-type: application/json" -d '{"action":"reset"}'
```

1. Ouvrir `http://localhost:8888/quiz/?s=demo` en mode responsive 390×844. On doit voir « La partie va commencer… » après Jouer. Le pseudo est prérempli et 🎲 en propose un autre.
2. `curl … -d '{"action":"open"}'`. En 3 s au plus, la question 1/8 (échauffement) apparaît.
3. Répondre à toutes les questions : choix → confiance → question suivante. Tester « ↩ Changer de réponse », un tap sur une bulle IA dans L'Enquête, puis « Rien ne cloche ». À la fin : « C'est dans la boîte ☕ ».
4. Recharger la page : on reste sur l'écran d'attente (reprise via `localStorage`).
5. `curl … -d '{"action":"reveal"}'` : la révélation 1/8 s'affiche avec ✅/❌, les barres et l'explication.
6. `curl … -d '{"action":"goto","index":8}'` : la carte de profil s'affiche (emoji, score, « À revoir »).
7. `http://localhost:8888/quiz/?s=nope` → « Partie introuvable » ; `http://localhost:8888/quiz/` → « Lien incomplet ».

Expected : toutes les étapes se comportent comme décrit, sans erreur dans la console à part les avertissements `[quiz]` attendus.

- [ ] **Step 4 : commit**

```bash
git add quiz/index.html quiz/app.js
git commit -m "feat(quiz): player app (join, play, wait, reveal, profile)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : écran animateur

**Files :**
- Create : `quiz/host/index.html`, `quiz/host/host.js`

**Interfaces :**
- Consumes : `api`, `poll` ; `h`, `mount` ; `GAMES` ; `PROFILES` (Task 3) ; réponse de `GET host-state` (Task 6) ; global `qrcode` de `qrcode-generator@1.4.4`.
- Produces : page `/quiz/host/?s=<session>#key=<QUIZ_HOST_KEY>`. La clé est mémorisée sous `aic-quiz-hostkey` et retirée de l'URL.

- [ ] **Step 1 : `quiz/host/index.html`**

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Brise-glace · Animateur</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="../../design/tokens.css">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../quiz.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<script type="module" src="host.js"></script>
</head>
<body>
<div class="app host">
  <header id="head"></header>
  <main id="main"><p class="lead">Chargement…</p></main>
  <aside id="side"></aside>
</div>
</body>
</html>
```

- [ ] **Step 2 : `quiz/host/host.js`**

```js
import { api, poll } from "../lib/api.js";
import { h, mount } from "../lib/dom.js";
import { GAMES } from "../lib/games/index.js";
import { PROFILES } from "../lib/profiles.js";

const session = new URLSearchParams(location.search).get("s");
const KEY_STORAGE = "aic-quiz-hostkey";
const STATUS_LABEL = { closed: "fermée", open: "en cours", reveal: "révélation", done: "terminée" };
const els = { head: document.getElementById("head"), main: document.getElementById("main"), side: document.getElementById("side") };
const pct = (x) => Math.round((x ?? 0) * 100);

// The key arrives once in the URL fragment (never sent to servers or logs),
// is remembered in this browser, and removed from the address bar.
function readHostKey() {
  const match = location.hash.match(/key=([^&]+)/);
  if (match) {
    const key = decodeURIComponent(match[1]);
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* not remembered: the fragment must be passed again next time */
    }
    history.replaceState(null, "", location.pathname + location.search);
    return key;
  }
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}
const key = readHostKey();
let mainKey = null; // re-render the main panel only when status/index change (keeps videos playing)

function showError(text) {
  mainKey = null;
  mount(els.main, h("section", { class: "screen" }, h("h1", {}, "Écran animateur"), h("p", { class: "error" }, text)));
}

async function action(name, extra) {
  try {
    await api.host(session, key, name, extra);
    await refresh();
  } catch (err) {
    alert(`Action impossible : ${err.code ?? err.message}`);
  }
}

async function refresh() {
  if (!key) return showError(`Clé animateur manquante : ouvrez /quiz/host/?s=${session}#key=<QUIZ_HOST_KEY>`);
  let data;
  try {
    data = await api.hostState(session, key);
  } catch (err) {
    if (err.status === 401) return showError("Clé animateur invalide.");
    if (err.status === 503) return showError("QUIZ_HOST_KEY n'est pas configurée sur Netlify.");
    if (err.status === 404) return showError(`Partie « ${session} » introuvable.`);
    throw err; // network: poll() logs and retries
  }
  renderHead(data);
  renderSide(data);
  const next = `${data.state.status}:${data.state.revealIndex}`;
  if (next !== mainKey) {
    mainKey = next;
    renderMain(data);
  }
}

function renderHead({ game, state }) {
  const n = game.questions.length;
  const i = state.revealIndex;
  const btn = (label, onclick, cls = "") => h("button", { class: `btn ${cls}`, type: "button", onclick }, label);
  const prev = () => action("goto", { index: Math.max(0, i - 1) });
  const next = () => action("goto", { index: Math.min(n, i + 1) });
  const controls = {
    closed: [btn("Ouvrir la partie", () => action("open"), "primary")],
    open: [btn("Révéler", () => action("reveal"), "primary")],
    reveal: [btn("◀", prev), btn(i >= n ? "Niveau du jour" : `${i + 1} / ${n}`, null, "ghost"), btn("▶", next), btn("Terminer", () => action("finish"), "primary")],
    done: [btn("◀", prev), btn(i >= n ? "Niveau du jour" : `${i + 1} / ${n}`, null, "ghost"), btn("▶", next)],
  }[state.status];
  const reset = btn("Réinitialiser", () => confirm("Effacer toutes les réponses de cette partie ?") && action("reset"), "danger");
  mount(
    els.head,
    h("div", {}, h("p", { class: "kicker" }, `AI Coffee · Brise-glace · ${STATUS_LABEL[state.status]}`), h("h1", {}, game.title)),
    h("div", { class: "controls" }, controls, reset),
  );
}

function renderSide({ players, game }) {
  const total = game.questions.length;
  const finished = players.filter((p) => p.answered >= total).length;
  mount(
    els.side,
    h("p", { class: "kicker" }, `${players.length} connecté(s) · ${finished} terminé(s)`),
    h(
      "ul",
      { class: "players" },
      players.map((p) =>
        h(
          "li",
          { class: "player" },
          h("span", {}, p.pseudo),
          h("span", { class: "bar-pct" }, `${p.answered}/${total}`),
          h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${Math.round((p.answered * 100) / total)}%` })),
        ),
      ),
    ),
  );
}

function renderMain(data) {
  const { state, game } = data;
  if (state.status === "closed" || state.status === "open") return mount(els.main, renderJoinPanel(state.status));
  if (state.revealIndex >= game.questions.length) return mount(els.main, renderSummary(data));
  const q = game.questions[state.revealIndex];
  mount(els.main, GAMES[q.game].renderReveal(q, data.stats[q.id], undefined));
}

function renderJoinPanel(status) {
  const url = `${location.origin}/quiz/?s=${encodeURIComponent(session)}`;
  const code = h("div", { class: "qr-code", role: "img", "aria-label": `QR code vers ${url}` });
  if (typeof qrcode === "function") {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    code.innerHTML = qr.createSvgTag(8, 2); // markup generated by the library from our own URL
  } else {
    code.textContent = "QR indisponible : utilisez le lien.";
  }
  return h(
    "section",
    { class: "qr" },
    code,
    h(
      "div",
      { class: "screen" },
      h("p", { class: "kicker" }, status === "closed" ? "Partie fermée : ouvrez-la pour commencer" : "Scannez pour jouer"),
      h("p", { class: "qr-url" }, url.replace(/^https?:\/\//, "")),
    ),
  );
}

function renderSummary({ globalScore, concepts, profiles }) {
  const rows = Object.values(concepts).sort((a, b) => (a.correctRate ?? 1) - (b.correctRate ?? 1));
  const rate = (x) => (x === null ? "—" : `${pct(x)} %`);
  return h(
    "section",
    { class: "screen" },
    h("p", { class: "kicker" }, "Niveau du jour"),
    h("p", { class: "summary-score" }, globalScore === null ? "—" : String(globalScore)),
    h(
      "ul",
      { class: "concepts" },
      rows.map((c) =>
        h(
          "li",
          { class: "bar" },
          h("span", { class: "bar-label" }, c.label),
          h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${pct(c.correctRate)}%` })),
          h("span", { class: "bar-pct" }, rate(c.correctRate)),
          c.previous ? h("span", { class: "concept-prev" }, `Session ${c.previous.session} : ${rate(c.previous.correctRate)} → aujourd'hui : ${rate(c.correctRate)}`) : null,
        ),
      ),
    ),
    h("ul", { class: "profiles" }, Object.values(PROFILES).map((p) => h("li", {}, `${p.emoji} ${p.title} · ${profiles[p.id] ?? 0}`))),
  );
}

if (!session) showError("Ajoutez ?s=<session> à l'URL.");
else poll(refresh, 2000);
```

- [ ] **Step 3 : vérification manuelle (écran 1920×1080 et téléphone côte à côte)**

1. `curl … -d '{"action":"reset"}'`, puis ouvrir `http://localhost:8888/quiz/host/?s=demo#key=dev-key`. La clé disparaît de l'URL. On voit « Partie fermée » et un QR code lisible.
2. Scanner le QR avec un téléphone sur le même réseau, ou ouvrir l'URL affichée dans un 2e navigateur. Le pseudo apparaît dans la colonne de droite en 2 s au plus.
3. « Ouvrir la partie » : la progression `n/8` avance pendant que le joueur répond.
4. « Révéler » : la question 1 s'affiche avec barres et explication. ◀ ▶ naviguent, et le téléphone suit.
5. ▶ jusqu'à « Niveau du jour » : score global, concepts du plus faible au plus fort, répartition des profils.
6. « Terminer » : statut « terminée ».
7. Ouvrir `http://localhost:8888/quiz/host/?s=demo#key=faux` → « Clé animateur invalide. »

Expected : comportements conformes, aucune vidéo rechargée tant qu'on ne change pas de question.

- [ ] **Step 4 : commit**

```bash
git add quiz/host/
git commit -m "feat(quiz): host screen (QR, live progress, reveal, niveau du jour)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : export de l'historique

**Files :**
- Create : `scripts/quiz-export.mjs`

**Interfaces :**
- Consumes : `GET export` (Task 6), `upsertHistory` (Task 4).
- Produces : `QUIZ_HOST_KEY=… pnpm quiz:export <session> --url https://<site>` réécrit `quiz-data/history.json`.

- [ ] **Step 1 : `scripts/quiz-export.mjs`**

```js
#!/usr/bin/env node
// After a session: pull the aggregated results and record them in quiz-data/history.json.
// QUIZ_HOST_KEY=… node scripts/quiz-export.mjs <session> --url https://<site>
import { readFile, writeFile } from "node:fs/promises";
import { upsertHistory } from "../netlify/lib/quiz/history.mjs";

const args = process.argv.slice(2);
const urlAt = args.indexOf("--url");
const base = urlAt >= 0 ? args[urlAt + 1] : process.env.QUIZ_BASE_URL;
const session = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--url");
const key = process.env.QUIZ_HOST_KEY;
if (!session || !base || !key) {
  console.error("Usage : QUIZ_HOST_KEY=… node scripts/quiz-export.mjs <session> --url https://<site>");
  process.exit(1);
}

const res = await fetch(`${base}/api/quiz/export?s=${encodeURIComponent(session)}`, { headers: { authorization: `Bearer ${key}` } });
const entry = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Export impossible : ${res.status} ${entry.error ?? ""} (la partie doit être « terminée »)`);
  process.exit(1);
}

const file = new URL("../quiz-data/history.json", import.meta.url);
const doc = JSON.parse(await readFile(file, "utf8"));
await writeFile(file, `${JSON.stringify(upsertHistory(doc, entry), null, 2)}\n`);
console.log(`✅ history.json mis à jour : session ${session}, ${entry.players} joueurs, niveau ${entry.globalScore}/100`);
```

- [ ] **Step 2 : vérifier en local**

Après `QUIZ_HOST_KEY=dev-key pnpm quiz:simulate demo` (qui termine la partie) :

Run : `QUIZ_HOST_KEY=dev-key pnpm quiz:export demo --url http://localhost:8888 && git diff --stat quiz-data/history.json && pnpm quiz:validate`
Expected : `✅ history.json mis à jour : session demo, 3 joueurs…`, le diff montre une entrée `"session": "demo"`, et la validation passe.

Puis annuler ces données de test : `git checkout quiz-data/history.json`.

Run : `QUIZ_HOST_KEY=dev-key pnpm quiz:export nope --url http://localhost:8888`
Expected : `Export impossible : 404 unknown_session…`, code de sortie 1.

- [ ] **Step 3 : commit**

```bash
git add scripts/quiz-export.mjs
git commit -m "feat(quiz): export script feeding quiz-data/history.json

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : skill `quiz`, intégration au deck et documentation

**Files :**
- Create : `.claude/skills/quiz/SKILL.md`
- Modify : `decks/_template/TEMPLATE-GUIDE.md` (table « Quel archétype pour quel bloc de contenu »), `CLAUDE.md` (paragraphe d'intro + section Layout)

**Interfaces :**
- Consumes : contrat (Tasks 1 et 4), `pnpm quiz:validate` (Task 4).
- Produces : commande `/quiz <NN>`, qui génère `quiz-data/sessions/NN.json` et l'enregistre dans `index.mjs`.

- [ ] **Step 1 : `.claude/skills/quiz/SKILL.md`**

````markdown
---
name: quiz
description: Use when the user wants to generate or update the quiz brise-glace for an AI Coffee session. Turns sessions/NN.md, the concept map and the cross-session history into quiz-data/sessions/NN.json, following the JSON contract, then validates it.
user-invocable: true
argument-hint: "<NN>"
---

# quiz — générer la partie brise-glace d'une session

Produit `quiz-data/sessions/NN.json` à partir de `sessions/NN.md`, de
`quiz-data/concepts.json` et de `quiz-data/history.json`. Le contrat fait foi :
`docs/superpowers/specs/2026-10-13-quiz-brise-glace-design.md` §2, appliqué par
`netlify/lib/quiz/validate.mjs`.

## Procédure

1. **Charger** `sessions/NN.md` (thème, talks, section *Concepts / rappels*),
   `quiz-data/concepts.json`, `quiz-data/history.json`. Si `sessions/NN.md` manque,
   s'arrêter et le dire.
2. **Choisir les concepts cibles** :
   - 3–4 concepts liés au thème de la session (en proposer de nouveaux pour
     `concepts.json` si le référentiel ne les couvre pas : id kebab-case, label,
     famille parmi `fondamentaux | limites | prompting | usages`, définition d'une phrase) ;
   - 1–2 **rappels**, marqués `"revisits": "<session d'origine>"` : d'abord les concepts
     dont le dernier `correctRate` est < 0.6, puis ceux non revus depuis ≥ 2 sessions.
     Si l'historique est vide, rappeler des concepts des *Concepts / rappels* des
     sessions précédentes.
3. **Composer** 1 échauffement (`warmup: true`, idéalement une vidéo IA manifestement
   absurde) + 6–7 questions comptées : ~2 `human_or_ai`, ~2 `bet_machine`, 2–3
   `investigation` / `prompt_duel`. Chaque question a un `concept` et une
   `explanation` pédagogique de 1–2 phrases qui **nomme** le phénomène.
4. **Seulement du contenu vérifiable** :
   - `bet_machine` et `prompt_duel` : les réponses et `outputs` doivent être de vraies
     sorties obtenues auprès d'un modèle nommé dans l'explication. Si tu ne peux pas les
     obtenir toi-même, mets `"verify": true` et dis à l'organisateur quoi capturer.
   - `human_or_ai` : un texte « human » doit avoir une source citée dans l'explication ;
     un contenu « ai » doit réellement être généré.
   - Vidéos : propose des candidats (lien, `start`, `end`) et marque-les
     `"verify": true` ; un organisateur vérifie la disponibilité et l'origine,
     puis retire le drapeau. Ajouter `media.fallback` (image) si possible.
   - `investigation` : la ligne fautive doit être une ligne `ai` ; une question
     « rien ne cloche » (`answer: null`) par partie au plus.
5. **Écrire** `quiz-data/sessions/NN.json` (`"session": "NN"`) et ajouter au registre
   `quiz-data/sessions/index.mjs` :
   `import sNN from "./NN.json" with { type: "json" };` et la clé `"NN": sNN` dans
   l'objet exporté.
6. **Valider** : `pnpm quiz:validate NN`. Corriger jusqu'à ✅. Lister les `verify: true`
   restants comme travail pour l'organisateur. Avant la session réelle :
   `pnpm quiz:validate --strict NN` doit passer.
7. **Ne pas commiter** : présenter la partie (tableau question / jeu / concept / réponse)
   pour relecture.

## Après la session

`QUIZ_HOST_KEY=… pnpm quiz:export NN --url https://<site>`, puis commiter
`quiz-data/history.json`.
````

- [ ] **Step 2 : `decks/_template/TEMPLATE-GUIDE.md`**

Dans la table « Quel archétype pour quel bloc de contenu », ajouter cette ligne juste après la ligne **Sommaire** :

```markdown
| Brise-glace (quiz d'ouverture) : l'URL `/quiz/?s=NN` à scanner | **Démo** (la « commande » = l'URL ; le QR est affiché par l'écran animateur `/quiz/host/`) | `.demo` | 07 |
```

- [ ] **Step 3 : `CLAUDE.md`**

Remplacer la phrase d'intro :

```
There is no build system, package manager, or test suite — this is a documentation/presentation repo, not an application.
```

par :

```
It is mostly a documentation/presentation repo. The one application is the **quiz brise-glace** (`quiz/`, `netlify/`, `quiz-data/`): vanilla JS without a build step, one Netlify Function + Netlify Blobs, `pnpm test` (node:test). Spec: `docs/superpowers/specs/2026-10-13-quiz-brise-glace-design.md`.
```

Et ajouter à la fin de la liste « Layout » :

```markdown
- `quiz/` — quiz brise-glace front: player app (`index.html`, `app.js`), host screen (`host/`), shared pure modules (`lib/scoring.js`, `lib/profiles.js`, `lib/pseudo.js`) and one module per game (`lib/games/`).
- `netlify/` — `functions/quiz-api.mjs` (the `/api/quiz/*` function) and `lib/quiz/` (testable API, content access, validator).
- `quiz-data/` — the quiz content contract: `concepts.json`, `sessions/NN.json` (+ `sessions/index.mjs` registry), `history.json`. **Never published** (forced 404 in `netlify.toml`); generated with the `quiz` skill, validated with `pnpm quiz:validate`.
```

- [ ] **Step 4 : vérifier**

Run : `pnpm test && pnpm quiz:validate`
Expected : PASS, puis ✅ partout (2 avertissements `verify` pour `demo`).

- [ ] **Step 5 : commit**

```bash
git add .claude/skills/quiz/SKILL.md decks/_template/TEMPLATE-GUIDE.md CLAUDE.md
git commit -m "feat(quiz): generation skill, deck mapping and docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : déploiement, partie de la session 05 et répétition

**Files :**
- Create : `quiz-data/sessions/05.json` (via le skill)
- Modify : `quiz-data/sessions/index.mjs`, `quiz-data/concepts.json` (si le skill propose des concepts)

**Interfaces :**
- Consumes : tout ce qui précède.

- [ ] **Step 1 : configurer Netlify (manuel, organisateur)**

Netlify → *Site configuration* → *Environment variables* : créer `QUIZ_HOST_KEY`, une valeur longue et aléatoire générée par `openssl rand -hex 24`, avec le scope *Functions*. La conserver dans le gestionnaire de mots de passe des co-organisateurs.

- [ ] **Step 2 : vérifier le deploy preview de la PR**

```bash
SITE=https://deploy-preview-<n>--<site>.netlify.app
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/quiz-data/sessions/demo.json"   # attendu : 404
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/node_modules/@netlify/blobs/package.json"   # attendu : 404
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/quiz-data/concepts.json"   # attendu : 404
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/quiz-data/sessions/index.mjs"   # attendu : 404
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/Quiz-Data/sessions/demo.json"   # attendu : 404 (ou aucun contenu)
curl -s -o /dev/null -w "%{http_code}\n" "$SITE//quiz-data/sessions/demo.json"   # attendu : 404 (ou aucun contenu)
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/quiz%2Ddata/sessions/demo.json"   # attendu : 404 (ou aucun contenu)
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/.env"   # attendu : 404
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/.superpowers/"   # attendu : 404
curl -s "$SITE/api/quiz/state?s=demo"   # attendu : {"status":"closed","revealIndex":0} (ou l'état courant)
curl -s -w " %{http_code}\n" "$SITE/api/quiz/game?s=inconnue"   # attendu : 404 ; noter le code renvoyé (R10)
QUIZ_HOST_KEY=<clé> pnpm quiz:simulate demo --url "$SITE"   # attendu : ✅ Simulation terminée
```

Expected : tous les 404 (ou aucun contenu de fichier), l'état JSON, puis la simulation complète. La réponse de `/api/quiz/state` prouve aussi qu'esbuild a bien embarqué les imports JSON avec attributs d'import (la fonction répond au lieu d'échouer au chargement). Noter le statut et le code qu'un 404 de la fonction renvoie en production (R10) : `{"error":"unknown_session"}` attendu ; sous `netlify dev`, le CLI rejoue les 404 de la fonction et affiche `not_found`. Les clients ne se fient qu'au statut 404.

- [ ] **Step 3 : générer la partie 05**

Prérequis : `sessions/05.md` existe. Sinon, l'écrire d'abord : c'est la source du deck **et** du quiz.

Lancer `/quiz 05`, relire le tableau proposé, capturer les vraies sorties LLM et vérifier les vidéos, retirer chaque `verify: true`, puis :

Run : `pnpm quiz:validate --strict 05`
Expected : `✅ sessions/05.json`, code de sortie 0.

```bash
git add quiz-data/
git commit -m "feat(quiz): brise-glace game for session 05

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4 : répétition chronométrée (2 organisateurs + 3 joueurs)**

Sur le deploy preview ou en production, avec `?s=05` :
1. Animateur : `/quiz/host/?s=05#key=<clé>` en partage d'écran Meet. **Réinitialiser**, puis **Ouvrir la partie**. Démarrer le chrono.
2. Joueurs : 1 iPhone (Safari), 1 Android (Chrome), 1 ordinateur. Scanner le QR et jouer. Vérifier que la vidéo d'échauffement se lit sur les deux mobiles.
3. **Révéler** à ~6:00 et débriefer en parcourant les questions (◀ ▶), puis afficher **Niveau du jour**.
4. Pendant la partie, sur un des téléphones : répondre très vite à plusieurs questions d'affilée, couper le réseau (mode avion) pour une ou deux réponses, constater l'indication « réponse non envoyée », puis rétablir le réseau. L'écran animateur doit finir par compter toutes les réponses de ce joueur.
5. Arrêter le chrono : **≤ 12:00** attendu. Si c'est plus long, retirer une question ou raccourcir des explications.
6. **Réinitialiser** à la fin de la répétition. Les joueurs de test vident leur stockage local ou utilisent une fenêtre privée le jour J.

Expected : déroulé complet, temps ≤ 12 min, aucun blocage sur mobile.

- [ ] **Step 5 : jour J et après**

- Avant la session : **Réinitialiser** la partie 05.
- Pendant : diapo *Démo* « Brise-glace » avec l'URL, l'URL collée dans le chat Meet, puis partage de l'onglet animateur.
- Après : **Terminer**, puis :

```bash
QUIZ_HOST_KEY=<clé> pnpm quiz:export 05 --url https://<site>
pnpm quiz:validate
git add quiz-data/history.json
git commit -m "chore(quiz): record session 05 results in history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Couverture de la spec

| Spec | Tâche |
|---|---|
| §1 flux open → reveal → done, révélation forcée, questions sautables | 5, 6, 9, 10 |
| §1 4 mini-jeux, confiance, concept + explication | 1, 8 |
| §1 résilience (reprise, retardataire spectateur, 409, retry) | 5, 9 |
| §2.1 référentiel | 1 |
| §2.2 contrat + validateur (vidéo, `verify`, échauffement, 5–8) | 1, 4 |
| §2.3 history + export | 4, 6, 11 |
| §3.1 front vanilla, un module par jeu | 8, 9, 10 |
| §3.2 endpoints, clé animateur, validation des entrées | 5, 6, 7 |
| §3.3 Blobs (un blob par joueur, un blob par réponse — écart 6 —, `members/<uid>`) | 5, 6 |
| §3.4 scoring, niveau du jour, comparaison historique | 2, 4, 6 |
| §3.5 profils, badge, pseudo | 3 |
| §4.1 skill `quiz` (rappels, contenus vérifiables, validation) | 12 |
| §4.2 intégration session (deck, Meet, onglet animateur, export) | 12, 13 |
| §4.3 livrables + répétition | 13 |
| §4.4 tests (node:test, simulation, mobiles) | 1–7, 9, 10, 13 |
| §4.5 risques (fallback vidéo, fuite, temps, contenu faux, RGPD) | 4, 7, 8, 12, 13 |
