import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest, isNewCodeLongEnough } from "@/lib/somastep-api";

describe("SomaStep API requirements", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: "test-token" }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds the ngrok header to login and bearer authorization to authenticated requests", async () => {
    await apiRequest("/api/login", {
      method: "POST",
      body: { username: "parent", password: "example-code" },
    });
    await apiRequest("/api/me", { token: "session-token" });

    const loginHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const protectedHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);

    expect(loginHeaders.get("ngrok-skip-browser-warning")).toBe("true");
    expect(loginHeaders.get("Authorization")).toBeNull();
    expect(protectedHeaders.get("ngrok-skip-browser-warning")).toBe("true");
    expect(protectedHeaders.get("Authorization")).toBe("Bearer session-token");
  });

  it("requires at least eight characters for a new code", () => {
    expect(isNewCodeLongEnough("1234567")).toBe(false);
    expect(isNewCodeLongEnough("12345678")).toBe(true);
  });
});