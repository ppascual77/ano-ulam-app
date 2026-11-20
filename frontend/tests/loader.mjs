// Lets `node --test` run the app's TypeScript directly, no build step:
//   node --import ./frontend/tests/loader.mjs --test frontend/tests/
// (npm run test:unit). Registers hooks.mjs, which resolves the "@/" alias
// and extensionless imports, stands in for the few native/network modules
// the tested files touch, and strips types with sucrase (already installed
// with Tailwind).
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
