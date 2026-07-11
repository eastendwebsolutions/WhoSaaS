import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireCursorUsageAdmin, toServerErrorResponse } from "@/app/api/reports/_shared";
import { db } from "@/lib/db";
import { cursorTeamConnections } from "@/lib/db/schema";
import { encrypt } from "@/lib/utils/crypto";

const bodySchema = z.object({
  apiKey: z.string().min(8),
  cursorTeamId: z.string().max(160).optional(),
});

/** Backward-compatible alias for legacy developer-effectiveness connection route. */
export async function PUT(request: NextRequest) {
  const { user, response } = await requireCursorUsageAdmin();
  if (!user) return response!;

  try {
    const json = bodySchema.parse(await request.json());
    const encrypted = encrypt(json.apiKey);
    const existingRows = await db.query.cursorTeamConnections.findMany({
      where: and(eq(cursorTeamConnections.companyId, user.companyId), eq(cursorTeamConnections.isActive, true)),
      limit: 1,
    });
    const existing = existingRows[0];
    if (existing) {
      await db
        .update(cursorTeamConnections)
        .set({
          apiKeyEncrypted: encrypted,
          cursorTeamId: json.cursorTeamId ?? existing.cursorTeamId,
          updatedAt: new Date(),
          createdByUserId: user.id,
        })
        .where(eq(cursorTeamConnections.id, existing.id));
    } else {
      await db.insert(cursorTeamConnections).values({
        companyId: user.companyId,
        accountLabel: "Default",
        apiKeyEncrypted: encrypted,
        cursorTeamId: json.cursorTeamId ?? null,
        createdByUserId: user.id,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
