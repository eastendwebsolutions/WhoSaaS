import { NextRequest, NextResponse } from "next/server";
import { requireReportUser, toServerErrorResponse } from "@/app/api/reports/_shared";
import { getCursorUsageUsers } from "@/lib/services/cursor/cursor-query";
import { parseCursorUsageFilters } from "@/lib/services/cursor/cursor-validation";

export async function GET(request: NextRequest) {
  const { user, response } = await requireReportUser();
  if (!user) return response!;

  try {
    const filters = parseCursorUsageFilters(request.nextUrl.searchParams);
    const users = await getCursorUsageUsers(user.companyId, filters);
    return NextResponse.json({ users });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
