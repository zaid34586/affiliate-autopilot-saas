/**
 * Phase 7 — Knowledge Base API
 * GET    /api/dashboard/knowledge/[id] - document detail (with content)
 * DELETE /api/dashboard/knowledge/[id] - delete document + chunks
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getDocument, deleteDocument } from "@/lib/knowledge/knowledge";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const document = await getDocument(session.user.workspaceId, id);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    console.error("Get knowledge document error:", error);
    return NextResponse.json({ error: "Failed to load document" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const ok = await deleteDocument(session.user.workspaceId, id);
    if (!ok) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete knowledge document error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
