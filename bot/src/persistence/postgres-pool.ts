import { Pool } from "pg";

const SUPABASE_HOST_SUFFIXES = [".supabase.co", ".supabase.com", ".pooler.supabase.com"];

function isSupabaseHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return SUPABASE_HOST_SUFFIXES.some((suffix) => normalized === suffix.slice(1) || normalized.endsWith(suffix));
}

export function normalizeDatabaseUrl(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (!trimmed) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (!isSupabaseHostname(url.hostname) || url.searchParams.has("sslmode")) {
    return trimmed;
  }

  url.searchParams.set("sslmode", "require");
  return url.toString();
}

export function createPostgresPool(databaseUrl: string): Pool {
  const normalized = normalizeDatabaseUrl(databaseUrl);
  const url = new URL(normalized);
  const isSupabase = isSupabaseHostname(url.hostname);

  const port = url.port ? Number(url.port) : undefined;
  const database = url.pathname.replace(/^\/+/, "") || undefined;

  return new Pool({
    host: url.hostname,
    port: Number.isFinite(port) ? port : undefined,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database,
    ...(isSupabase ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}
