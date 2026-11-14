/**
 * Phase 6 — WhatsApp Links API
 * GET /api/dashboard/settings/whatsapp-links - List all links
 * POST /api/dashboard/settings/whatsapp-links - Create new link
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { createWhatsAppLink, listWhatsAppLinks } from "@/lib/dm/whatsapp-bot";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const links = await listWhatsAppLinks(workspaceId);
    return NextResponse.json({ links });
  } catch (error) {
    console.error("List WhatsApp links error:", error);
    return NextResponse.json({ error: "Failed to list links" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { name: string; phoneNumber: string; defaultMessage?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, phoneNumber, defaultMessage, utmSource, utmMedium, utmCampaign, utmContent } = body;

  if (!name || !phoneNumber) {
    return NextResponse.json({ error: "name and phoneNumber required" }, { status: 400 });
  }

  try {
    const link = await createWhatsAppLink(workspaceId, {
      name,
      phoneNumber,
      defaultMessage,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("Create WhatsApp link error:", error);
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }
}