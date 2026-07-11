import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { requireReportUser, toServerErrorResponse } from "@/app/api/reports/_shared";
import { getCursorUsageUsers } from "@/lib/services/cursor/cursor-query";
import { parseCursorUsageFilters } from "@/lib/services/cursor/cursor-validation";

export async function GET(request: NextRequest) {
  const { user, response } = await requireReportUser();
  if (!user) return response!;

  try {
    const filters = parseCursorUsageFilters(request.nextUrl.searchParams);
    const users = await getCursorUsageUsers(user.companyId, filters);
    const csv = stringify(
      users.map((row) => ({
        account: row.accountLabel,
        name: row.displayName,
        email: row.email,
        mapped: row.mapped ? "yes" : "no",
        spend_dollars: row.spendDollars ?? "",
        pool_share_percent: row.poolSharePercent ?? "",
        suggestion_count: row.suggestionCount,
      })),
      { header: true },
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cursor-usage.csv"',
      },
    });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
