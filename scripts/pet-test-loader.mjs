import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
const require = createRequire(import.meta.url), cache = new Map();
export function loadTS(path) {
  const absolute = resolve(path);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {}; cache.set(absolute, exports);
  const source = ts.transpileModule(readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", source)((name) => {
    if (name.startsWith("@/")) return loadTS(`${name.slice(2)}.ts`);
    if (name.startsWith(".")) { const path = resolve(dirname(absolute), name); return loadTS(`${path}${existsSync(`${path}.ts`) ? ".ts" : ".tsx"}`); }
    return require(name);
  }, exports);
  return exports;
}
