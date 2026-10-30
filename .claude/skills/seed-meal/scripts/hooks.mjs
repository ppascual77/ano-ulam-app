// Module resolution for running the app's own TS (api/*.ts, admin utils) in
// plain Node with built-in type stripping, so /seed-meal uses the exact code
// Seed Meal uses instead of a copy:
// - "@/lib/supabase" → nodeSupabase.ts (the app's client needs the phone's
//   secure storage and AppState)
// - "@/..." → the project root, like tsconfig's path alias
// - extensionless relative imports → .ts / index.ts
// - expo-* / react-native* → an empty module (only phone-only helpers in
//   api/ use them, e.g. the DA PDF download; the skill never calls those)
import { existsSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolvePath(scriptsDir, "../../../..");
const EMPTY_MODULE = "data:text/javascript,export default {};";

function withExtension(path) {
  for (const candidate of [path, `${path}.ts`, join(path, "index.ts")]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      if (candidate === path && !/\.(ts|mjs|js|json)$/.test(path)) continue;
      return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/supabase") {
    return { url: pathToFileURL(join(scriptsDir, "nodeSupabase.ts")).href, shortCircuit: true };
  }
  if (/^(expo-|react-native|@react-native|@expo\/)/.test(specifier)) {
    return { url: EMPTY_MODULE, shortCircuit: true };
  }
  let target = null;
  if (specifier.startsWith("@/")) target = join(projectRoot, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target) {
    const found = withExtension(target);
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
