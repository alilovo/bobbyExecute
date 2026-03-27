import { NextRequest, NextResponse } from "next/server";
import { forwardControlRequest } from "../../../../lib/control-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function resolveTargetPath(segments: string[]): string {
  const joined = segments.join("/").replace(/^\/+/, "");
  if (!joined || joined === "status") {
    return "/control/status";
  }
  if (joined === "emergency-stop") {
    return "/emergency-stop";
  }
  if (joined === "reset") {
    return "/control/reset";
  }
  if (joined.startsWith("control/")) {
    return `/${joined}`;
  }
  return `/control/${joined}`;
}

function extractProxyHeaders(request: NextRequest): HeadersInit {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const requestId = request.headers.get("x-request-id");
  if (requestId) {
    headers.set("x-request-id", requestId);
  }

  const idempotencyKey = request.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    headers.set("x-idempotency-key", idempotencyKey);
  }

  return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const targetPath = resolveTargetPath(path);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  const upstream = await forwardControlRequest(
    targetPath,
    {
      method: request.method,
      headers: extractProxyHeaders(request),
      body,
    },
    process.env
  );

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": contentType,
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
