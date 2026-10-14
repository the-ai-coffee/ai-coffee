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
