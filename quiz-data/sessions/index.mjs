// Registry of playable games. esbuild bundles these JSON files into the Netlify
// function, so quiz-data/ never has to be published. One line per session file.
import demo from "./demo.json" with { type: "json" };

export default { demo };
