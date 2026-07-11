import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireCursorUsageAdmin, toServerErrorResponse } from "@/app/api/reports/_shared";
import { db } from "@/lib/db";
import { cursorTeamConnections } from "@/lib/db/schema";

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCursorUsageAdmin();
  if (!user) return response!;

  try {
    const { id } = await context.params;
    const existing = await db.query.cursorTeamConnections.findFirst({
      where: and(eq(cursorTeamConnections.id, id), eq(cursorTeamConnections.companyId, user.companyId)),
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db
      .update(cursorTeamConnections)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cursorTeamConnections.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
