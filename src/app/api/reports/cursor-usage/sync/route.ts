import { NextRequest, NextResponse } from "next/server";
import { requireCursorUsageAdmin, toServerErrorResponse } from "@/app/api/reports/_shared";
import { syncAllActiveCursorConnections } from "@/lib/services/cursor/cursor-sync";

export async function POST(request: NextRequest) {
  const { user, response } = await requireCursorUsageAdmin();
  if (!user) return response!;

  try {
    const body = (await request.json().catch(() => ({}))) as { connectionId?: string };
    const results = await syncAllActiveCursorConnections(user.companyId, body.connectionId);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
