import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CONTROL_SECRET = "dashboard-control-secret";
const CONTROL_SERVICE_URL = "https://control.internal";
const BOT_API_URL = "https://bot.example";

function resetEnv(): void {
  delete process.env.CONTROL_SERVICE_URL;
  delete process.env.CONTROL_TOKEN;
  delete process.env.NEXT_PUBLIC_API_URL;
  delete process.env.NEXT_PUBLIC_USE_MOCK;
}

describe("dashboard control proxy", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CONTROL_SERVICE_URL = CONTROL_SERVICE_URL;
    process.env.CONTROL_TOKEN = CONTROL_SECRET;
    process.env.NEXT_PUBLIC_API_URL = BOT_API_URL;
    process.env.NEXT_PUBLIC_USE_MOCK = "false";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEnv();
  });

  it("keeps browser-facing mutations on the dashboard proxy without exposing the control secret", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, message: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { api } = await import("../../../dashboard/src/lib/api.ts");

    await api.emergencyStop();
    await api.reset();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/control/emergency-stop");
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/control/reset");
    const firstHeaders = new Headers(fetchMock.mock.calls[0][1] as RequestInit | undefined);
    const secondHeaders = new Headers(fetchMock.mock.calls[1][1] as RequestInit | undefined);
    expect(firstHeaders.get("authorization")).toBeNull();
    expect(secondHeaders.get("authorization")).toBeNull();
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(CONTROL_SECRET);
  });

  it("forwards server-side dashboard control requests with bearer auth to the private control service", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, accepted: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { POST } = await import("../../../dashboard/src/app/api/control/[...path]/route.ts");

    const request = new Request("http://localhost/api/control/mode", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-123",
        "x-idempotency-key": "idem-456",
      },
      body: JSON.stringify({ mode: "paper", reason: "proxy test" }),
    });

    const response = await POST(request as unknown as import("next/server").NextRequest, {
      params: Promise.resolve({ path: ["mode"] }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe(`${CONTROL_SERVICE_URL}/control/mode`);
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${CONTROL_SECRET}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("req-123");
    expect(headers.get("x-idempotency-key")).toBe("idem-456");

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      accepted: true,
    });
  });
});
