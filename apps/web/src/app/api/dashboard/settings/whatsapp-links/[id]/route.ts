/**
 * Phase 6 — WhatsApp Link Detail API
 * GET /api/dashboard/settings/whatsapp-links/[id] - Get link details
 * PATCH /api/dashboard/settings/whatsapp-links/[id] - Update link
 * DELETE /api/dashboard/settings/whatsapp-links/[id] - Delete link
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getWhatsAppLink, updateWhatsAppLink, deleteWhatsAppLink, toggleWhatsAppLink, getClickToChatUrl } from "@/lib/dm/whatsapp-bot";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  try {
    const link = await getWhatsAppLink(workspaceId, id);
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    return NextResponse.json({ link, clickToChatUrl: getClickToChatUrl(link) });
  } catch (error) {
    console.error("Get WhatsApp link error:", error);
    return NextResponse.json({ error: "Failed to get link" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  let body: { name?: string; phoneNumber?: string; defaultMessage?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { enabled, ...updates } = body;

  try {
    let link;
    if (enabled !== undefined) {
      link = await toggleWhatsAppLink(workspaceId, id, enabled);
    } else {
      link = await updateWhatsAppLink(workspaceId, id, updates);
    }
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    return NextResponse.json({ link, clickToChatUrl: getClickToChatUrl(link) });
  } catch (error) {
    console.error("Update WhatsApp link error:", error);
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { id } = await params;

  try {
    await deleteWhatsAppLink(workspaceId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete WhatsApp link error:", error);
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
  }
}