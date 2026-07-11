import { NextRequest, NextResponse } from "next/server";
import { requireReportUser, toServerErrorResponse } from "@/app/api/reports/_shared";
import { getCursorUsageSummary, getCursorWorkspaceContext } from "@/lib/services/cursor/cursor-query";

export async function GET(request: NextRequest) {
  const { user, response } = await requireReportUser();
  if (!user) return response!;

  try {
    const connectionId = request.nextUrl.searchParams.get("connectionId") ?? undefined;
    const [summary, workspace] = await Promise.all([
      getCursorUsageSummary(user.companyId, connectionId),
      getCursorWorkspaceContext(user.companyId),
    ]);
    return NextResponse.json({ ...summary, workspace });
  } catch (error) {
    return toServerErrorResponse(error);
  }
}
