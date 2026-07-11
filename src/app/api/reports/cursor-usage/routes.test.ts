import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/current-user", () => ({
  getOrCreateCurrentUser: vi.fn(),
}));

vi.mock("@/lib/services/cursor/cursor-query", () => ({
  getCursorUsageSummary: vi.fn(),
  getCursorWorkspaceContext: vi.fn(),
  listCursorConnections: vi.fn(),
}));

vi.mock("@/lib/services/cursor/cursor-sync", () => ({
  syncAllActiveCursorConnections: vi.fn(),
}));

import { GET as getSummary } from "./summary/route";
import { GET as getConnections } from "./connections/route";
import { POST as postSync } from "./sync/route";
import { getOrCreateCurrentUser } from "@/lib/auth/current-user";
import { getCursorUsageSummary, getCursorWorkspaceContext, listCursorConnections } from "@/lib/services/cursor/cursor-query";

const adminUser = {
  id: "11111111-1111-1111-1111-111111111111",
  companyId: "22222222-2222-2222-2222-222222222222",
  role: "company_admin" as const,
  email: "admin@example.com",
};

const plainUser = {
  id: "33333333-3333-3333-3333-333333333333",
  companyId: "22222222-2222-2222-2222-222222222222",
  role: "user" as const,
  email: "user@example.com",
};

describe("cursor-usage routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated summary", async () => {
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue(null);
    const res = await getSummary(new NextRequest("http://localhost/api/reports/cursor-usage/summary"));
    expect(res.status).toBe(401);
  });

  it("returns 200 for standard user summary", async () => {
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue(plainUser as never);
    vi.mocked(getCursorUsageSummary).mockResolvedValue({ cards: [], lastSyncAt: null, connections: [] } as never);
    vi.mocked(getCursorWorkspaceContext).mockResolvedValue({
      companyName: "Acme",
      asanaWorkspaceId: "ws1",
    } as never);
    const res = await getSummary(new NextRequest("http://localhost/api/reports/cursor-usage/summary"));
    expect(res.status).toBe(200);
  });

  it("returns 403 for standard user sync", async () => {
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue(plainUser as never);
    const res = await postSync(new NextRequest("http://localhost/api/reports/cursor-usage/sync", { method: "POST" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 for admin connections read", async () => {
    vi.mocked(getOrCreateCurrentUser).mockResolvedValue(adminUser as never);
    vi.mocked(listCursorConnections).mockResolvedValue([]);
    const res = await getConnections();
    expect(res.status).toBe(200);
  });
});
