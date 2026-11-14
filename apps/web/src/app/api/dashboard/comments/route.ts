/**
 * GET  /api/dashboard/comments — list comments (newest first).
 * POST /api/dashboard/comments — ingest a comment (webhook-ready input):
 *   { platform, postId?, authorHandle, body }
 *   → sentiment + suggested reply per approval settings.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { ingestComment, listComments } from "@/lib/character/replies";

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const comments = await listComments(session.user.workspaceId);
    return NextResponse.json({ comments });
  } catch (e) {
    console.error("List comments error:", e);
    return NextResponse.json(
      { error: "Failed to list comments" },
      { status: 500 },
    );
  }
}

const ALLOWED_PLATFORMS = ["instagram", "youtube", "tiktok", "facebook", "x"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = typeof body.platform === "string" ? body.platform : "";
  const authorHandle =
    typeof body.authorHandle === "string" ? body.authorHandle.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const postId = typeof body.postId === "string" ? body.postId : null;

  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `platform must be one of: ${ALLOWED_PLATFORMS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!authorHandle) {
    return NextResponse.json(
      { error: "authorHandle is required" },
      { status: 400 },
    );
  }
  if (!text || text.length > 1000) {
    return NextResponse.json(
      { error: "body is required (max 1000 characters)" },
      { status: 400 },
    );
  }

  try {
    const result = await ingestComment(workspaceId, {
      platform,
      postId,
      authorHandle: authorHandle.startsWith("@")
        ? authorHandle.slice(1)
        : authorHandle,
      body: text,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to ingest comment";
    const status = msg.includes("character") ? 404 : 500;
    if (status === 500) console.error("Ingest comment error:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
