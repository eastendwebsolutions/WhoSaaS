import { NextRequest, NextResponse } from "next/server";
import { requireReportUser, toServerErrorResponse } from "@/app/api/reports/_shared";
import { getCursorFeatureTrends, getCursorUsageTrends } from "@/lib/services/cursor/cursor-query";
import { parseCursorUsageFilters } from "@/lib/services/cursor/cursor-validation";

export async function GET(request: NextRequest) {
  const { user, response } = await requireReportUser();
  if (!user) return response!;

  try {
    const filters = parseCursorUsageFilters(request.nextUrl.searchParams);
    const [usage, features] = await Promise.all([
      getCursorUsageTrends(user.companyId, filters),
      getCursorFeatureTrends(user.companyId, filters),
    ]);
    return NextResponse.json({ usage, features });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
