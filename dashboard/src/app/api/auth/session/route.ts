import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildDashboardOperatorIdentityLabel,
  isDashboardAuthConfigured,
  isDashboardSessionActive,
  parseDashboardSessionCookie,
} from "@/lib/operator-auth";
import { DASHBOARD_SESSION_COOKIE } from "@/lib/operator-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = parseDashboardSessionCookie(cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value, process.env);
  const activeSession = session && isDashboardSessionActive(session) ? session : null;

  return NextResponse.json({
    configured: isDashboardAuthConfigured(process.env),
    authenticated: Boolean(activeSession),
    session: activeSession,
    identityLabel: buildDashboardOperatorIdentityLabel(activeSession),
  });
}
