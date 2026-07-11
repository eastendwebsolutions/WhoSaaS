import { NextRequest, NextResponse } from "next/server";
import { requireReportUser, toServerErrorResponse } from "@/app/api/reports/_shared";
import { getCursorCoachingSuggestions } from "@/lib/services/cursor/cursor-query";

export async function GET(request: NextRequest) {
  const { user, response } = await requireReportUser();
  if (!user) return response!;

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId") ?? undefined;
    const userId = request.nextUrl.searchParams.get("userId") ?? undefined;
    const suggestions = await getCursorCoachingSuggestions(user.companyId, connectionId, userId);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
