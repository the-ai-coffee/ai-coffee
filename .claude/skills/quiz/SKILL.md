---
name: quiz
description: Use when the user wants to generate or update the Quiz Espresso for an AI Coffee session. Turns sessions/NN.md, the concept map and the cross-session history into quiz-data/sessions/NN.json, following the JSON contract, then validates it.
user-invocable: true
argument-hint: "<NN>"
---

# quiz — générer la partie Espresso d'une session

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
   Chaque jeu affiche déjà sa consigne fixe (« Ce contenu a-t-il été créé par un humain
   ou par une IA ? », etc.) : n'ajoute un champ `question` (≤ 300 caractères) que pour
   préciser ce qu'il faut regarder. Les durées par défaut (15 s *Humain ou IA ?*, 20 s
   *Pariez*, 30 s *Enquête* et *Duel*) conviennent en général ; pose `timeLimit`
   (5–120) seulement si la lecture est plus longue ou plus courte que la normale.
4. **Seulement du contenu vérifiable** :
   - `bet_machine` et `prompt_duel` : les réponses et `outputs` doivent être de vraies
     sorties obtenues auprès d'un modèle nommé dans l'explication. Si tu ne peux pas les
     obtenir toi-même, mets `"verify": true` et dis à l'organisateur quoi capturer.
   - `human_or_ai` : un texte « human » doit avoir une source citée dans l'explication ;
     un contenu « ai » doit réellement être généré.
   - Vidéos : propose des candidats (lien, `start`, `end`) et marque-les
     `"verify": true` ; un organisateur vérifie la disponibilité et l'origine,
     puis retire le drapeau. Ajouter `media.fallback` (image) si possible.
   - Médias par URL : utilise `"media": { "url": "https://…" }` — lien YouTube complet
     (`watch?v=`, `youtu.be/`, Shorts, `t=` pour le début) ou Vimeo, image directe
     (`.jpg .png .webp .gif .avif`, avec `alt`) ou vidéo directe (`.mp4 .webm .mov`).
     Pas de TikTok/Instagram/X/Facebook : trouve la vidéo sur YouTube ou un mp4.
     Ajoute `start`/`end` pour un extrait. YouTube/Vimeo avec `end` : le timer attend
     (`end` − `start`) secondes après l'affichage de la question, que la vidéo soit
     lancée ou non (les joueurs doivent appuyer sur lecture tout de suite) ; sans `end`,
     il démarre aussitôt. Fichier vidéo direct : le timer attend la fin de la vidéo
     (ou de l'extrait si `end` est donné), plafonné à sa durée. `media.fallback` doit
     être une URL `https`.
   - `investigation` : la ligne fautive doit être une ligne `ai` ; une question
     « rien ne cloche » (`answer: null`) par partie au plus.
   - Le média ne doit pas trahir la réponse : noms de fichiers neutres (pas de
     « ai », « human » ni de nom d'outil dans `src`), aucun champ de crédit ou de
     source dans `media` (l'attribution va uniquement dans `explanation`), et
     vérifier que le titre des vidéos ne donne pas la réponse.
5. **Écrire** `quiz-data/sessions/NN.json` (`"session": "NN"`, `"title": "On se met en jambes"` :
   titre générique, sans « Espresso », déjà affiché au-dessus, ni thème de session) et ajouter au registre
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
`quiz-data/history.json`. Ce fichier est embarqué dans la fonction au moment du
build : la comparaison avec l'historique sur l'écran animateur ne se met à jour
qu'après ce commit **et** un redéploiement.
