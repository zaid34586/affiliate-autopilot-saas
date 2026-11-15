/**
 * Phase 7 — Templates Library API
 * GET    /api/dashboard/templates/[id] - template detail (builtin or own workspace)
 * DELETE /api/dashboard/templates/[id] - delete custom template (own workspace only)
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTemplate, deleteCustomTemplate } from "@/lib/templates/templates";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const template = await getTemplate(session.user.workspaceId, id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    console.error("Get template error:", error);
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await deleteCustomTemplate(session.user.workspaceId, id);
    if (!result.ok) {
      const status = result.error === "Template not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete template error:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
