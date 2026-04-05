import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SRC_ROOT = resolve(process.cwd(), "src");
const TEST_ROOT = resolve(process.cwd(), "tests");
const TOKEN_UNIVERSE_SOURCE = resolve(SRC_ROOT, "core/contracts/tokenuniverse.ts");
const TOKEN_UNIVERSE_SOURCE_JS = TOKEN_UNIVERSE_SOURCE.replace(/\.ts$/, ".js");
const TOKEN_UNIVERSE_BUILDER_SOURCE = resolve(SRC_ROOT, "core/universe/token-universe-builder.ts");
const TOKEN_UNIVERSE_BUILDER_SOURCE_JS = TOKEN_UNIVERSE_BUILDER_SOURCE.replace(/\.ts$/, ".js");

function walkTsFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const full = resolve(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(full));
      continue;
    }
    if (full.endsWith(".ts")) {
      files.push(full);
    }
  }

  return files;
}

function toRel(root: string, absPath: string): string {
  return absPath.slice(root.length + 1).replaceAll("\\", "/");
}

function parseImports(text: string): string[] {
  const imports: string[] = [];
  const pattern = /from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    imports.push(match[1]);
    match = pattern.exec(text);
  }
  return imports;
}

function resolveImportTarget(filePath: string, specifier: string): string | null {
  if (specifier.startsWith("@bot/")) {
    const relative = specifier.slice("@bot/".length).replace(/\.js$/, ".ts");
    return resolve(SRC_ROOT, relative);
  }

  if (specifier.startsWith(".")) {
    const resolved = resolve(dirname(filePath), specifier);
    if (resolved.endsWith(".ts") || resolved.endsWith(".js")) {
      return resolved;
    }
    if (statExists(`${resolved}.ts`)) {
      return `${resolved}.ts`;
    }
    if (statExists(`${resolved}.js`)) {
      return `${resolved}.js`;
    }
    return null;
  }

  return null;
}

function statExists(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function findImporters(root: string, targetPaths: string[]): string[] {
  return walkTsFiles(root)
    .filter((filePath) => {
      const imports = parseImports(readFileSync(filePath, "utf8"));
      return imports.some((specifier) => {
        const resolved = resolveImportTarget(filePath, specifier);
        return resolved !== null && targetPaths.includes(resolved);
      });
    })
    .map((filePath) => toRel(root, filePath))
    .sort();
}

describe("removed token-universe residue inventory", () => {
  it("keeps token-universe-builder as explicitly test-only residue", () => {
    expect(statExists(TOKEN_UNIVERSE_BUILDER_SOURCE)).toBe(true);
    expect(statExists(TOKEN_UNIVERSE_BUILDER_SOURCE_JS)).toBe(false);

    const srcImporters = findImporters(SRC_ROOT, [TOKEN_UNIVERSE_BUILDER_SOURCE, TOKEN_UNIVERSE_BUILDER_SOURCE_JS]);
    const testImporters = findImporters(TEST_ROOT, [TOKEN_UNIVERSE_BUILDER_SOURCE, TOKEN_UNIVERSE_BUILDER_SOURCE_JS]);

    expect(srcImporters).toEqual([]);
    expect(testImporters).toEqual(["core/universe-builder.test.ts", "migration/parity-harness.ts"]);
  });

  it("confirms token-universe residue has been removed", () => {
    expect(statExists(TOKEN_UNIVERSE_SOURCE)).toBe(false);
    expect(statExists(TOKEN_UNIVERSE_SOURCE_JS)).toBe(false);

    const srcImporters = findImporters(SRC_ROOT, [TOKEN_UNIVERSE_SOURCE, TOKEN_UNIVERSE_SOURCE_JS]);
    const testImporters = findImporters(TEST_ROOT, [TOKEN_UNIVERSE_SOURCE, TOKEN_UNIVERSE_SOURCE_JS]);

    expect(srcImporters).toEqual([]);
    expect(testImporters).toEqual([]);
  });

  it("keeps source callers detached from the removed token-universe contract", () => {
    const sourceFiles = [
      "core/universe/token-universe-builder.ts",
      "adapters/dexscreener/mapper.ts",
      "core/normalize/normalizer.ts",
      "core/validate/cross-source-validator.ts",
      "intelligence/quality/build-data-quality.ts",
    ];

    for (const relPath of sourceFiles) {
      const text = readFileSync(resolve(SRC_ROOT, relPath), "utf8");
      expect(text).not.toContain("../contracts/tokenuniverse.js");
      expect(text).not.toContain("@bot/core/contracts/tokenuniverse.js");
    }

    const builderText = readFileSync(
      resolve(SRC_ROOT, "core/universe/token-universe-builder.ts"),
      "utf8"
    );
    expect(builderText).toContain("../contracts/normalized-token.js");
  });
});
