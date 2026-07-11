import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireCursorUsageAdmin, requireReportUser, toServerErrorResponse } from "@/app/api/reports/_shared";
import { db } from "@/lib/db";
import { cursorTeamConnections } from "@/lib/db/schema";
import { listCursorConnections } from "@/lib/services/cursor/cursor-query";
import { encrypt } from "@/lib/utils/crypto";

export async function GET() {
  const { user, response } = await requireReportUser();
  if (!user) return response!;
  try {
    const connections = await listCursorConnections(user.companyId);
    return NextResponse.json({ connections });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}

const putSchema = z.object({
  id: z.string().uuid().optional(),
  accountLabel: z.string().min(1).max(160),
  apiKey: z.string().min(8).optional(),
  cursorTeamId: z.string().max(160).optional(),
});

export async function PUT(request: NextRequest) {
  const { user, response } = await requireCursorUsageAdmin();
  if (!user) return response!;

  try {
    const json = putSchema.parse(await request.json());
    if (json.id) {
      const existing = await db.query.cursorTeamConnections.findFirst({
        where: and(eq(cursorTeamConnections.id, json.id), eq(cursorTeamConnections.companyId, user.companyId)),
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await db
        .update(cursorTeamConnections)
        .set({
          accountLabel: json.accountLabel,
          cursorTeamId: json.cursorTeamId ?? existing.cursorTeamId,
          apiKeyEncrypted: json.apiKey ? encrypt(json.apiKey) : existing.apiKeyEncrypted,
          updatedAt: new Date(),
          createdByUserId: user.id,
        })
        .where(eq(cursorTeamConnections.id, existing.id));
      return NextResponse.json({ ok: true, id: existing.id });
    }

    if (!json.apiKey) {
      return NextResponse.json({ error: "apiKey is required for new connections" }, { status: 400 });
    }
    const [created] = await db
      .insert(cursorTeamConnections)
      .values({
        companyId: user.companyId,
        accountLabel: json.accountLabel,
        apiKeyEncrypted: encrypt(json.apiKey),
        cursorTeamId: json.cursorTeamId ?? null,
        createdByUserId: user.id,
      })
      .returning({ id: cursorTeamConnections.id });
    return NextResponse.json({ ok: true, id: created.id, syncRecommended: true });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
