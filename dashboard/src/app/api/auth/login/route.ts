import { NextRequest, NextResponse } from "next/server";
import {
  authenticateDashboardOperator,
  buildDashboardSessionCookie,
  isDashboardAuthConfigured,
} from "@/lib/operator-auth";
import { DASHBOARD_SESSION_COOKIE } from "@/lib/operator-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isDashboardAuthConfigured(process.env)) {
    return NextResponse.json(
      {
        authenticated: false,
        configured: false,
        reason: "dashboard operator auth is not configured",
      },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const result = authenticateDashboardOperator(username, password, process.env);
  if (!result.authenticated) {
    return NextResponse.json(
      {
        authenticated: false,
        configured: result.configured,
        reason: result.reason,
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json(
    {
      authenticated: true,
      configured: true,
      session: result.session,
    },
    { status: 200 }
  );
  const cookie = buildDashboardSessionCookie(result.session, process.env);
  response.cookies.set({
    name: cookie.name ?? DASHBOARD_SESSION_COOKIE,
    value: cookie.value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return response;
}
