import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cursorUserIdentities, users } from "@/lib/db/schema";
import type { CursorSpendRow } from "./types";

export type ResolvedIdentity = {
  cursorExternalUserId: string;
  sourceEmail: string;
  userId: string | null;
};

export async function resolveIdentitiesForConnection(
  companyId: string,
  connectionId: string,
  spendRows: CursorSpendRow[],
): Promise<Map<string, ResolvedIdentity>> {
  const companyUsers = await db.query.users.findMany({
    where: eq(users.companyId, companyId),
    columns: { id: true, email: true },
  });
  const emailToUserId = new Map(companyUsers.map((u) => [u.email.toLowerCase(), u.id]));
  const result = new Map<string, ResolvedIdentity>();

  for (const row of spendRows) {
    const email = row.email.toLowerCase();
    const userId = emailToUserId.get(email) ?? null;
    result.set(row.userId, {
      cursorExternalUserId: row.userId,
      sourceEmail: row.email,
      userId,
    });

    await db
      .insert(cursorUserIdentities)
      .values({
        companyId,
        connectionId,
        cursorExternalUserId: row.userId,
        userId,
        sourceEmail: row.email,
      })
      .onConflictDoUpdate({
        target: [cursorUserIdentities.connectionId, cursorUserIdentities.cursorExternalUserId],
        set: {
          userId,
          sourceEmail: row.email,
          updatedAt: new Date(),
        },
      });
  }

  return result;
}
