export interface CliArgs {
  _: string[];
  [key: string]: string | boolean | string[] | undefined;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const eqIndex = token.indexOf("=");
    if (eqIndex > 2) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

export function readCliString(args: CliArgs, key: string, fallback?: string): string | undefined {
  const value = args[key];
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return fallback;
}

export function readCliBoolean(args: CliArgs, key: string, fallback = false): boolean {
  const value = args[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return fallback;
}

export async function closePool(pool: unknown): Promise<void> {
  const closable = pool as { end: () => Promise<unknown> };
  await closable.end().catch(() => undefined);
}
