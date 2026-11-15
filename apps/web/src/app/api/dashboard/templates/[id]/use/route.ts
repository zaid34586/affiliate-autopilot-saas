/**
 * Phase 7 — Templates Library API
 * POST /api/dashboard/templates/[id]/use - increment usage counter
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { recordTemplateUse, getTemplate } from "@/lib/templates/templates";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Scope check first — only count uses of visible templates
    const template = await getTemplate(session.user.workspaceId, id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await recordTemplateUse(id);
    return NextResponse.json({ ok: true, usageCount: template.usageCount + 1 });
  } catch (error) {
    console.error("Record template use error:", error);
    return NextResponse.json({ error: "Failed to record usage" }, { status: 500 });
  }
}
