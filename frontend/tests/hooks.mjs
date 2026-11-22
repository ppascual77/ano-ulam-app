// Node module hooks for the unit tests (see loader.mjs).
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transform } from "sucrase";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "../..");
const STUBS = resolvePath(ROOT, "frontend/tests/stubs");

// Native or network modules the tested files import, swapped for tiny fakes.
const STUBBED = {
  "@react-native-async-storage/async-storage": "asyncStorage.mjs",
  "@/api/dailyUsage": "dailyUsage.mjs",
  "@/api/daPrices": "daPrices.mjs",
  "@/frontend/features/auth/hooks/useAuth": "useAuth.mjs",
};

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];

function findFile(base) {
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (STUBBED[specifier]) return { url: pathToFileURL(resolvePath(STUBS, STUBBED[specifier])).href, shortCircuit: true };
  let base = null;
  if (specifier.startsWith("@/")) base = resolvePath(ROOT, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    const file = findFile(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith("file:") && /\.tsx?$/.test(url)) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const { code } = transform(source, {
      transforms: url.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"],
      filePath: fileURLToPath(url),
      disableESTransforms: true,
    });
    return { format: "module", source: code, shortCircuit: true };
  }
  return next(url, context);
}
