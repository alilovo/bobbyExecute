export interface ControlClientOptions {
  baseUrl: string;
  token: string;
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveControlServiceBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = trimOrUndefined(env.CONTROL_SERVICE_URL);
  if (explicit) {
    return explicit;
  }

  const host = trimOrUndefined(env.CONTROL_SERVICE_HOSTNAME);
  const port = trimOrUndefined(env.CONTROL_SERVICE_PORT) ?? trimOrUndefined(env.PORT);
  if (host && port) {
    return `http://${host}:${port}`;
  }

  if (env.NODE_ENV === "development") {
    return "http://127.0.0.1:3334";
  }

  throw new Error("CONTROL_SERVICE_URL or CONTROL_SERVICE_HOSTNAME/CONTROL_SERVICE_PORT must be configured.");
}

export function resolveControlServiceToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = trimOrUndefined(env.CONTROL_TOKEN);
  if (!token) {
    throw new Error("CONTROL_TOKEN must be configured for dashboard control proxying.");
  }
  return token;
}

export function buildControlServiceUrl(path: string, env: NodeJS.ProcessEnv = process.env): URL {
  const baseUrl = resolveControlServiceBaseUrl(env);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

export function buildControlRequestHeaders(
  initHeaders: HeadersInit | undefined,
  env: NodeJS.ProcessEnv = process.env
): Headers {
  const headers = new Headers(initHeaders);
  headers.set("authorization", `Bearer ${resolveControlServiceToken(env)}`);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return headers;
}

export interface ForwardControlRequestOptions extends RequestInit {
  path: string;
  env?: NodeJS.ProcessEnv;
}

export async function forwardControlRequest(
  path: string,
  init: RequestInit = {},
  env: NodeJS.ProcessEnv = process.env
): Promise<Response> {
  const url = buildControlServiceUrl(path, env);
  const headers = buildControlRequestHeaders(init.headers, env);
  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
}
