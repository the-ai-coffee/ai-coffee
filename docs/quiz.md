# ☕ Quiz Espresso — mode d'emploi

> Le jeu de 8 à 12 min qui ouvre chaque session. Les participants scannent un QR code et jouent sur leur téléphone. L'animateur déclenche ensuite la révélation collective et affiche le **niveau du jour**.
> Conception : [`superpowers/specs/2026-10-13-quiz-brise-glace-design.md`](superpowers/specs/2026-10-13-quiz-brise-glace-design.md).

**Prérequis** : Node ≥ 22.12, `pnpm`, un accès au site Netlify. Dans la suite, `<site>` désigne l'URL du site, par exemple `https://<nom>.netlify.app`.

| Page | URL |
|---|---|
| Joueurs | `<site>/quiz/?s=NN` |
| Animateur | `<site>/quiz/host/?s=NN#key=<QUIZ_HOST_KEY>` |

------

## 🔐 Configuration (une seule fois)

1. Générez une clé animateur : `openssl rand -hex 24`.
2. Netlify → *Site configuration* → *Environment variables* : créez `QUIZ_HOST_KEY` avec cette valeur, scope *Functions*. Gardez-la dans le gestionnaire de mots de passe des co-organisateurs.
3. Redéployez le site.
4. Vérifiez que les réponses ne sont pas publiques : `curl -s -o /dev/null -w "%{http_code}\n" <site>/quiz-data/concepts.json` doit renvoyer `404`. La liste complète des vérifications est dans la tâche 13 du [plan](superpowers/plans/2026-10-13-quiz-brise-glace.md).

> ⚠️ **Attention** : la clé ne doit jamais être commitée. En local, elle vit dans `.env`, qui est ignoré par git.

------

## 🧩 Préparer la partie d'une session

1. Écrivez `sessions/NN.md`. Le quiz part du thème et de la section *Concepts / rappels*.
2. Dans Claude Code, lancez **`/quiz NN`**. Le skill :
   - choisit 3 ou 4 concepts liés au thème, plus 1 ou 2 rappels des sessions précédentes (concepts faibles dans `quiz-data/history.json` d'abord) ;
   - compose 1 échauffement et 6 ou 7 questions mêlant *Humain ou IA ?*, *Pariez sur la machine*, *L'Enquête* et *Duel de prompts* ;
   - écrit `quiz-data/sessions/NN.json`, l'enregistre dans `quiz-data/sessions/index.mjs`, puis lance la validation.
3. **Relisez et vérifiez** chaque question marquée `"verify": true` :
   - *Pariez sur la machine* et *Duel de prompts* : capturez les **vraies** réponses du modèle cité ;
   - vidéos : vérifiez que le lien marche, que l'extrait (`start`/`end`) est le bon et que l'origine est sûre ;
   - le média ne doit pas trahir la réponse : pas de nom de fichier contenant « ai » ou un nom d'outil, pas de titre de vidéo révélateur. L'attribution va dans `explanation`.

   Retirez ensuite le drapeau `verify`.

> 💡 **Médias par URL** : collez simplement l'URL dans `"media": { "url": "https://…" }` — YouTube (`watch?v=`, `youtu.be/`, Shorts, `t=42`), Vimeo, image (`.jpg`, `.png`, `.webp`, `.gif`, `.avif`, avec `alt`) ou vidéo (`.mp4`, `.webm`, `.mov`). `start`/`end` (en secondes) découpent un extrait. TikTok, Instagram, X et Facebook ne sont pas pris en charge.
>
> ⏱ **Timer** : 15 s *Humain ou IA ?*, 20 s *Pariez sur la machine*, 30 s *L'Enquête* et *Duel de prompts* ; `timeLimit` (5–120) le change pour une question. Pour une vidéo YouTube ou Vimeo avec `end`, le timer attend (`end` − `start`) secondes après l'affichage de la question, que la vidéo ait été lancée ou non : les joueurs doivent appuyer sur lecture tout de suite (sans `end`, le timer démarre immédiatement). Pour un fichier vidéo direct, le timer attend la fin de la vidéo, ou de l'extrait si `end` est donné (plafonné à sa durée). `media.fallback`, s'il est présent, doit être une URL `https`.

4. Validez en mode strict :

   ```bash
   pnpm quiz:validate --strict NN
   ```

5. Commitez `quiz-data/` et déployez. Le contenu est embarqué dans la fonction au moment du build : **pas de déploiement, pas de partie**.
6. Dans le deck, ajoutez une diapo « Espresso » sur l'archétype *Démo*, avec l'URL joueurs (voir `decks/_template/TEMPLATE-GUIDE.md`).

> 💡 **Astuce** : `quiz-data/sessions/demo.json` est une partie de démonstration qui couvre les 4 jeux. Elle sert à s'entraîner, jamais en vraie session.

------

## 🎬 Le jour J

| Quand | Animateur | Joueurs |
|---|---|---|
| Avant la session | Ouvrir l'écran animateur, cliquer sur **Réinitialiser** | — |
| 0:00 | Partager l'onglet animateur dans Meet (le QR s'affiche), coller l'URL joueurs dans le chat, cliquer sur **Ouvrir la partie** | Scanner le QR, valider le pseudo proposé (toucher l'avatar pour en changer, 🎲 tire un autre pseudo et un autre avatar), puis **Jouer** |
| 1:00 – 6:00 | Suivre le **chrono global** (10 min par défaut, ±1 min si besoin) et la colonne des joueurs (avatar, `n/8`, ✓ quand le joueur a répondu ou laissé passer toutes les questions) | Répondre avant la fin du timer (choix, puis confiance) ; flash « Réponse enregistrée » |
| ~6:00 | **Révéler** quand tout le monde a fini, ou plus tôt s'il y a un retardataire | Les réponses sont verrouillées |
| 6:00 – 10:00 | Débriefer au clavier : `Espace` / `→` question suivante, `←` précédente (la bonne réponse apparaît après ~1 s de suspense) | Flash **BRAVO ! / RATÉ / PAS RÉPONDU** puis le détail |
| 10:00 | ▶ jusqu'au **Niveau du jour**, puis **Terminer** | Profil IA et progression personnelle |

- La première fois, ouvrez l'écran animateur avec `#key=…` dans l'URL. La clé est ensuite mémorisée dans ce navigateur et retirée de la barre d'adresse.
- Un retardataire qui arrive après la révélation suit en spectateur. Une réponse envoyée trop tard est signalée « Trop tard » sur son téléphone.
- Raccourcis de l'écran animateur : `→` suivant · `←` précédent · `Espace` révéler puis suivant · `F` plein écran. Les boutons réagissent immédiatement.
- Quand le chrono global atteint 0, il clignote et le bouton **Révéler** pulse : c'est vous qui décidez du moment.
- Un joueur qui recharge sa page reprend où il en était. Les réponses non envoyées (réseau instable) sont réessayées automatiquement, et un compteur les affiche.

------

## 📈 Après la session

1. Vérifiez que la partie est bien **Terminée**. L'export la refuse sinon.
2. Exportez les agrégats. Seuls des chiffres sont exportés, sans aucun pseudo :

   ```bash
   QUIZ_HOST_KEY=<clé> pnpm quiz:export NN --url <site>
   pnpm quiz:validate
   git add quiz-data/history.json && git commit -m "chore(quiz): record session NN results in history"
   ```

3. Déployez. `history.json` est lui aussi embarqué au build, donc la comparaison « session précédente → aujourd'hui » de l'écran animateur n'utilise les nouveaux chiffres qu'après ce déploiement. C'est cet historique qui guide les rappels du prochain `/quiz`.

------

## 🧪 Tester en local

```bash
pnpm install
printf 'QUIZ_HOST_KEY=dev-key\n' > .env    # ignoré par git
pnpm dev                                    # http://localhost:8888 (Netlify Blobs en local)
```

- Joueurs : `http://localhost:8888/quiz/?s=demo`. Animateur : `http://localhost:8888/quiz/host/?s=demo#key=dev-key`.
- Partie complète simulée avec 3 faux joueurs :

  ```bash
  QUIZ_HOST_KEY=dev-key pnpm quiz:simulate demo
  ```

  > ⚠️ **Attention** : la simulation commence par **réinitialiser** la partie. Ne la lancez jamais contre une session réelle en cours.
- Tests et validation : `pnpm test`, `pnpm quiz:validate`.

------

## 🛟 Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Clé animateur invalide » | La clé dans `#key=` ne correspond pas à `QUIZ_HOST_KEY` | Rouvrir l'écran animateur avec la bonne clé |
| « QUIZ_HOST_KEY n'est pas configurée » | Variable absente sur Netlify | La créer (scope *Functions*), puis redéployer |
| « Partie introuvable » | `NN.json` absent du registre `index.mjs`, ou pas encore déployé | `pnpm quiz:validate NN`, commit, déploiement |
| « QR indisponible » | La librairie QR (cdnjs) ne s'est pas chargée | Coller l'URL joueurs dans le chat Meet |
| Un joueur reste sur « La partie va commencer… » | La partie n'est pas ouverte, ou elle a été réinitialisée | **Ouvrir la partie**. Le joueur recharge sa page si besoin |
| `quiz:export` → `409 not_done` | La partie n'est pas terminée | Cliquer sur **Terminer**, puis relancer l'export |
| `quiz:validate --strict` échoue sur `verify: true` | Contenu pas encore vérifié | Vérifier la question, puis retirer le drapeau |
