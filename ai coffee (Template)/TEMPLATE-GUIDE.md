# ☕ IA Coffee — Guide de génération des decks

> **Objectif** : produire le deck d'un épisode à partir de son `sessions/NN.md`, de façon **déterministe et cohérente**, en réutilisant les archétypes de `IA Coffee — Template Light.html`.
> **Prérequis** : le contenu de l'épisode existe dans `sessions/NN.md` (résumé + une section par talk). Le composant `deck-stage.js` est partagé, ne pas le modifier.

------

## 🧠 Mental Model

```
sessions/NN.md  ──►  on découpe en BLOCS de contenu
                         │
                         ▼
        chaque bloc ──► on choisit UN archétype (table ci-dessous)
                         │
                         ▼
        on remplit les classes de l'archétype (jamais la structure)
                         │
                         ▼
                 deck HTML de l'épisode
```

Règle d'or : **le template est un système, pas une page à redécorer.** L'impact vient de la typo et du contraste déjà câblés, pas de décorations ajoutées slide par slide. On remplit, on ne réinvente pas.

------

## 🎨 Le système (invariants à NE PAS casser)

| Dimension | Règle | Pourquoi |
|---|---|---|
| Couleur | Neutres crème/encre tiédis (OKLCH) **+ un seul accent rust** (`--accent`). Aucune autre couleur. | Stratégie *Restrained*. Cohérence inter-épisodes. |
| Accent | Rust = ponctuation : un mot clé, un chiffre, une flèche. S'engage à fond **uniquement** sur les slides Impact et Comparaison. | L'impact concentré frappe ; l'accent partout devient bruit. |
| Typo | Serif éditorial (Instrument Serif) très grand pour les titres, italique rust en emphase. Mono (JetBrains) pour labels/folios. Sans (Geist 300) pour le corps. | La typo EST l'impact visuel. |
| Geste signature | `<span class="stroke">mot</span>` = trait rust sous un mot clé du titre. Un par titre, pas plus. | Fil de marque récurrent. |
| Contraste | `class="ink"` sur une `<section>` = fond espresso sombre. **Réservé au beat de ponctuation** (slide Impact). Max 1 à 2 slides sombres par deck. | Une slide sombre au milieu de la crème = ça claque. En abuser tue l'effet. |
| Échelle | Slides authored à 1920×1080. `deck-stage` scale tout seul. Ne pas toucher au `width`/`height`. | — |

------

## 🗂️ Quel archétype pour quel bloc de contenu

| Bloc dans `sessions/NN.md` | Archétype | Classe racine | Slide réf. |
|---|---|---|---|
| Ouverture de l'épisode (titre, thème, tags) | **Cover** | `.cover` | 01 |
| Le déroulé / les phases de la session | **Sommaire** | `.toc` | 02 |
| Définition d'**un** concept (1 terme = 1 slide) | **Définition** | `.define` | 03 |
| **Un chiffre fort** : gain, coût, ROI, impact mesuré | **Impact** (sombre) | `.stat` + `class="ink"` | 04 |
| Un process / pipeline en 3–4 étapes | **Schéma** | `.flow` | 05 |
| Avant / après, sans IA / avec IA, problème / solution | **Comparaison** | `.compare` | 06 |
| Une démo live (ce qu'on construit + commande) | **Démo** | `.demo` | 07 |
| La liste des termes clés (phase « Glossaire ») | **Glossaire** | `.gloss` | 08 |
| Récap + ressources + teaser épisode suivant | **Clôture** | `.close` | 09 |

> 💡 **Note** : ces 9 archétypes couvrent le format de session standard (Expresso → Théorie → Démos → Glossaire & Q&R) plus le positionnement « impact mesuré ». Un épisode n'utilise pas forcément les 9, et peut répéter un archétype (ex. 3 définitions, 2 démos). Garder l'ordre narratif du `sessions/NN.md`.

------

## ✍️ Quoi remplir dans chaque archétype

Remplir **uniquement** le contenu textuel. Ne pas changer les balises ni les classes de structure.

- **Cover** `.cover` : `.episode` (n°), `h1` (titre, mot clé en `<span class="stroke">`), `.meta` (durée · démos · format), `.topics .chip` (mots clés ; le 1er en `.lead-chip`).
- **Sommaire** `.toc` : `h2.title` (accroche), `.txt` (1 phrase), une `.row` par phase (`.n` numéro, `.name` titre, `.sub` sous-items mono, `.dur` durée).
- **Définition** `.define` : `.label` (terme EN), `h2.title` (formule mémorable, emphase `<em>`/`.stroke`), `p.lead` (définition), 3 `.point` (`.n`, `h3`, `p`).
- **Impact** `.stat` (+ `class="ink"`) : `.top` (cas métier), `.big` (le chiffre ; unité en `<span class="unit">`, signe en `<em>`), `.ctx` (ce que ça veut dire), `.foot` (2–3 repères avant/après en `<b>`). **Un seul chiffre par slide.**
- **Schéma** `.flow` : `h2.title`, 4 `.step` max (`.n`, `h3` avec `<span class="arrow">→</span>` sauf le 1er, `p`).
- **Comparaison** `.compare` : côté `.before` (atténué) et côté `.after` (accentué) ; chacun `.tag`, `.head`, `ul>li` (valeurs fortes du côté après en `<b>`).
- **Démo** `.demo` : `.marker` (n° démo), `h2.title`, `.build .row` (étapes), `.terminal` (commandes ; `.p` prompt, `.c` commentaire vert, `.dim` sortie).
- **Glossaire** `.gloss` : 4 à 8 `.term` (`.name` serif + `.def` sans). Au-delà de 8, faire 2 slides.
- **Clôture** `.close` : `.recap` (chaîne de mots, dernier en `<em>`), `.res .item` (`.src` + `.url`), `.next` (épisode suivant).

------

## 🔧 Procédure de génération (résumé)

1. Lire `sessions/NN.md`, lister les blocs dans l'ordre.
2. Mapper chaque bloc à un archétype (table ci-dessus).
3. Copier `IA Coffee — Template Light.html` → `IA Coffee NN — <Thème>.html`.
4. Pour chaque slide : garder la `<section>` de l'archétype voulu, remplacer le contenu, mettre à jour `data-label`, le `.folio` (`NN / total`) et la `.baseline`.
5. Supprimer les `<section>` d'archétypes non utilisés ; dupliquer celles répétées.
6. Vérifier au navigateur (via `deck-stage`) : aucun débordement, le folio compte juste, **une seule** slide `ink` (l'Impact).

------

## ✅ Checklist avant publication

- [ ] Un seul accent rust, zéro autre couleur introduite.
- [ ] Titres en serif, un `.stroke` max par titre.
- [ ] La slide Impact (`.ink`) est unique et porte **un** chiffre.
- [ ] Folios cohérents (`NN / total`), `.baseline` à jour sur chaque slide.
- [ ] Aucun texte coupé par le bas (tester le rendu, surtout `.stat` et les titres longs).
- [ ] Export PDF OK (Print → Save as PDF via `deck-stage`).

> **Document créé le** : 2026-06-19
> **Couvre** : `IA Coffee — Template Light.html` (9 archétypes)
> **Voir aussi** : `CLAUDE.md` (flux `sessions/NN.md` → deck), `CONTEXT.md` (glossaire projet)
