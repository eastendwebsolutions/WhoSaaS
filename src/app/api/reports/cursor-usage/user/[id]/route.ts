import { NextRequest, NextResponse } from "next/server";
import { requireReportUser, toServerErrorResponse } from "@/app/api/reports/_shared";
import { getCursorUserDetail } from "@/lib/services/cursor/cursor-query";
import { parseCursorUsageFilters } from "@/lib/services/cursor/cursor-validation";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireReportUser();
  if (!user) return response!;

  try {
    const { id } = await context.params;
    const filters = parseCursorUsageFilters(request.nextUrl.searchParams);
    const detail = await getCursorUserDetail(user.companyId, id, filters);
    return NextResponse.json(detail);
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
