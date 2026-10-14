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
