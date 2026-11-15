/**
 * Phase 7 — Knowledge Base API
 * GET  /api/dashboard/knowledge             - list documents
 * POST /api/dashboard/knowledge             - ingest (multipart file | {url} | {title,text})
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  listDocuments,
  ingestFile,
  ingestUrl,
  ingestText,
} from "@/lib/knowledge/knowledge";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const documents = await listDocuments(session.user.workspaceId);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("List knowledge error:", error);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const contentType = req.headers.get("content-type") || "";

    // ── Multipart file upload ──
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      const title = (formData.get("title") as string) || undefined;

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await ingestFile({
        workspaceId,
        createdBy: session.user.id,
        filename: file.name || "document",
        bytes,
        title,
      });
      return NextResponse.json({ document }, { status: 201 });
    }

    // ── JSON body: url or text ──
    let body: { url?: string; title?: string; text?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (body.url) {
      const document = await ingestUrl({
        workspaceId,
        createdBy: session.user.id,
        url: body.url,
        title: body.title,
      });
      return NextResponse.json({ document }, { status: 201 });
    }

    if (body.text && body.title) {
      const document = await ingestText({
        workspaceId,
        createdBy: session.user.id,
        title: body.title,
        text: body.text,
      });
      return NextResponse.json({ document }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Provide multipart file, { url }, or { title, text }" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest document";
    if (/required|invalid|unsupported|too large|not allowed|too short|failed to fetch/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Knowledge ingest error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
