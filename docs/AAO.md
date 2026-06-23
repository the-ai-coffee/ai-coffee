# AI Coffee comme Organisation Autonome Agentique (AAO)

> ☕🤖 Faire tourner la boucle opérationnelle mensuelle d'AI Coffee par des agents, et faire de Michael et Xavier des **valideurs** plutôt que des opérateurs. Le moteur de cette AAO est **Hermes** (auto-hébergé), l'assistant agentique présenté en [Session #2](sessions/02.md).

Ce document décrit comment AI Coffee s'auto-organise. Il complète la stratégie produit ([project-vision.md](project-vision.md)) et le vocabulaire ([CONTEXT.md](CONTEXT.md)). Les décisions structurantes (cadence, plafond de cohorte, offres) restent définies dans la vision — l'AAO ne fait que les **exécuter**.

---

## 1. Ce que « AAO » veut dire pour AI Coffee

Pas de DAO, pas de trésorerie on-chain. Ici, AAO = **la boucle de session mensuelle s'exécute seule**, et les humains tiennent la porte sur tout ce qui est externe, coûte de l'argent, ou est difficile à annuler.

L'unité de travail est le **cycle de session** : choisir le thème → rechercher/construire le contenu → produire le deck → créer l'event Luma → promouvoir → animer → collecter le feedback → publier le cas d'usage → décider du thème suivant.

Principe directeur unique :

> **Un agent peut tout *préparer*, mais ne peut *engager* que les actions réversibles. Les actions à valeur s'arrêtent dans une file de validation.**

C'est aussi la meilleure démo possible : un meetup IA qui *est lui-même* une organisation agentique devient sa propre entrée vedette dans le futur Use Case Catalog.

---

## 2. Le gradient d'autonomie

**Autonome (réversible, interne, peu coûteux) — l'agent agit seul :**

- Rédiger le contenu de `sessions/NN.md` et générer le deck (`ai coffee (Template)/deck-stage.js`)
- Rechercher un thème, résumer l'actu IA pour l'« Expresso d'accueil »
- Dépouiller le feedback Tally/QR, calculer la rétention N → N+1
- Proposer les thèmes de la session suivante à partir du vote communautaire
- Rédiger des entrées brouillon du Use Case Catalog dans Notion (état *draft*)
- Session Posts RS: chaque session, poste un recap technique (ce que tu as montré, les tradeoffs discutés) 
- Expresso matin RS: poste un résumé de l'actu IA (ce que tu as trouvé, pourquoi c'est important)

**Humain dans la boucle (irréversible, public, ou engage argent/réputation) — passe par la file de validation :**

- Publier un event Luma (engage une date publiquement)
- Poster sur LinkedIn / annonces communautaires
- Envoyer un email à la cohorte
- Dépenser au-delà du plafond fixé (APIs, outils)
- Tout contact prospect B2B (A Coffee for Teams) ou client Prompt Bar
- Publier un cas d'usage publiquement (état *public*)

**Déclencheurs d'escalade** — une action saute toujours la porte (validation obligatoire) si elle : dépasse le plafond de dépense, nomme une personne/entreprise réelle, est publique, ou si la confiance de l'agent est basse.

---

## 3. Hermes comme moteur

Hermes (auto-hébergé par l'équipe — contrôle total des skills, de la mémoire et des outils, et prêt pour des données B2B on-prem) fournit toute l'infrastructure. Pas de stack parallèle à construire :

| Capacité Hermes | Rôle dans l'AAO |
|---|---|
| Mémoire persistante long terme | État partagé de l'org (cadence, rétention, backlog de thèmes, dépense vs plafond) |
| Orchestration multi-agents | Fait tourner le roster de skills ci-dessous et applique la porte de validation |
| Création auto de skills réutilisables | Le roster peut se compléter : Hermes propose un skill quand une tâche manuelle se répète (proposition **validée** par un humain) |
| Outils intégrés (terminal, fichiers, navigateur, vision, TTS) | Construit réellement les decks, lit les fichiers du repo, scrape l'actu IA |
| Passerelle multi-plateforme | Notifie Michael/Xavier (le ping de validation) là où ils sont déjà |
| Auto-hébergé | Données sensibles (futur B2B / Prompt Bar) gardées on-prem |

### Roster de skills

| Skill Hermes | Possède (autonome) | S'arrête pour validation |
|---|---|---|
| `analyste` | Calcule présence, rétention N→N+1, thèmes de feedback ; rédige le bilan post-session | — (lecture seule, sans danger) |
| `programmeur` | Rédige `sessions/NN.md`, génère le deck, choisit les analogies de l'« Instant Théorie » | Validation finale « deck prêt à présenter » |
| `community` | Rédige la description Luma + le post LinkedIn à partir du vote de thème | **Publication** de l'event Luma / du post |
| `catalog` | Rédige les entrées Use Case Catalog (secteur, chemin, impact) en *draft* | Passage d'une entrée en **public** |
| `intendant` | Suit la cadence et la dépense vs plafond, lève des alertes | Toute dépense > plafond ; tout contact B2B |

---

## 4. La porte humaine : file de validation Notion

Le mécanisme est volontairement simple et **auditable** (chaque action à valeur laisse une trace).

1. **Une base Notion « Actions à valider ».** Colonnes : *action*, *skill émetteur*, *pourquoi c'est à valeur*, *brouillon/payload*, *statut* (`pending` / `approved` / `rejected`), *raison du refus*. Toute action sous porte y atterrit au lieu de s'exécuter.
2. **Valider = changer le statut.** Michael ou Xavier passe la ligne en `approved` ; au run suivant, le skill actuateur (publier/poster/envoyer) n'exécute **que** les lignes `approved`.
3. **Refuser = statut `rejected` + une ligne de raison.** Hermes écrit la raison dans sa mémoire persistante ; le skill apprend pour la fois suivante.
4. **Time-box, ne bloque pas.** Si personne ne traite une ligne dans le délai imparti et que la cadence est menacée, le skill **escalade** (notification via la passerelle Hermes), il **n'auto-exécute jamais**. La consistance de cadence (KPI #1 de 2026) compte, mais jamais au prix d'un engagement public non relu.

---

## 5. Déploiement : crawl → walk → run

2026 est explicitement « tenir la cadence, ne pas ajouter de charge » ([vision §10](project-vision.md)). On n'allume pas tout le cerveau de l'org d'un coup.

- **Crawl (maintenant)** — un seul skill, `analyste`, en autonomie totale parce qu'il est en lecture seule et ne peut rien casser. Il transforme Tally/QR en signal de rétention (que la table de KPIs marque encore « pas mesurable »). Pur gain, et l'occasion de montrer Hermes faire tourner l'org *en live* — matière directe pour le catalog.
- **Walk (S4–S5)** — ajouter `programmeur` (rédaction de decks) et `community` (rédaction seule, publication sous porte Notion). C'est là qu'on récupère le plus d'heures d'organisation.
- **Run (2027, quand Prompt Bar / Catalog démarrent)** — `catalog` + gestion de prospects B2B, toutes deux fortement sous porte.

---

## 6. Risques propres à l'AAO

| Risque | Mitigation |
|---|---|
| Un agent engage une action à valeur non relue | La porte est un *défaut bloquant* : les skills actuateurs n'exécutent que les lignes `approved` ; jamais d'auto-exécution sur time-out |
| Dérive de qualité du contenu généré | Validation « deck prêt » obligatoire ; l'humain reste l'éditeur final |
| Dépendance à Hermes (point unique) | Auto-hébergé = contrôle ; l'état vit dans Notion + mémoire Hermes, exportable |
| Charge masquée de maintenance des skills | `intendant` suit le coût ; ne pas ajouter de skill avant qu'une tâche manuelle se répète vraiment |
