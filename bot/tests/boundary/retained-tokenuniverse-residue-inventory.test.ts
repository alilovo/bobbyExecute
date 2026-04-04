import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const SRC_ROOT = resolve(process.cwd(), "src");
const TEST_ROOT = resolve(process.cwd(), "tests");
const TOKEN_UNIVERSE_FRAGMENT = "core/contracts/tokenuniverse.js";

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

function findImporters(root: string, specifierFragment: string): string[] {
  return walkTsFiles(root)
    .filter((filePath) =>
      parseImports(readFileSync(filePath, "utf8")).some((specifier) =>
        specifier.includes(specifierFragment)
      )
    )
    .map((filePath) => toRel(root, filePath))
    .sort();
}

describe("retained token-universe residue inventory", () => {
  it("keeps the residue narrowed to test-only callers", () => {
    const srcImporters = findImporters(SRC_ROOT, TOKEN_UNIVERSE_FRAGMENT);
    const testImporters = findImporters(TEST_ROOT, TOKEN_UNIVERSE_FRAGMENT);

    expect(srcImporters).toEqual([]);
    expect(testImporters).toEqual([
      "contracts/tokenuniverse.test.ts",
      "core/universe-builder.test.ts",
    ]);

    expect([
      ...srcImporters,
      ...testImporters,
    ]).not.toContain("intelligence/quality/build-data-quality.ts");
  });

  it("keeps source callers detached from the legacy token-universe contract", () => {
    const sourceFiles = [
      "adapters/dexscreener/mapper.ts",
      "core/normalize/normalizer.ts",
      "core/validate/cross-source-validator.ts",
      "intelligence/quality/build-data-quality.ts",
    ];

    for (const relPath of sourceFiles) {
      const text = readFileSync(resolve(SRC_ROOT, relPath), "utf8");
      expect(text).not.toContain(TOKEN_UNIVERSE_FRAGMENT);
    }
  });
});
