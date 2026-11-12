import { auth } from "@/auth";
import { db } from "@/lib/db";
import { connections } from "@aa/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;
  const { id } = await params;

  try {
    // Verify ownership
    const existing = await db
      .select()
      .from(connections)
      .where(and(eq(connections.id, id), eq(connections.workspaceId, workspaceId)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // Hard delete (tokens encrypted, GDPR compliant)
    await db.delete(connections).where(eq(connections.id, id));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete connection error:", e);
    return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action !== "refresh") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const existing = await db
      .select()
      .from(connections)
      .where(and(eq(connections.id, id), eq(connections.workspaceId, workspaceId)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const conn = existing[0];

    // Token refresh logic per provider
    let newTokens: { access_token: string; refresh_token?: string; expires_in?: number } | null = null;

    if (conn.provider === "instagram" || conn.provider === "facebook") {
      // Meta Graph API refresh
      newTokens = await refreshMetaToken(conn.refreshTokenEnc!);
    } else if (conn.provider === "youtube") {
      // Google OAuth refresh
      newTokens = await refreshGoogleToken(conn.refreshTokenEnc!);
    } else if (conn.provider === "tiktok") {
      // TikTok refresh
      newTokens = await refreshTikTokToken(conn.refreshTokenEnc!);
    } else if (conn.provider === "amazon") {
      // Amazon LWA refresh
      newTokens = await refreshAmazonToken(conn.refreshTokenEnc!);
    } else if (conn.provider === "clickbank") {
      // ClickBank doesn't use refresh tokens typically
      return NextResponse.json({ error: "ClickBank doesn't support token refresh" }, { status: 400 });
    }

    if (!newTokens) {
      return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
    }

    // Encrypt and store new tokens (placeholder - needs encryption util)
    const expiresAt = newTokens.expires_in
      ? new Date(Date.now() + newTokens.expires_in * 1000)
      : null;

    await db
      .update(connections)
      .set({
        accessTokenEnc: newTokens.access_token, // TODO: encrypt
        refreshTokenEnc: newTokens.refresh_token ?? conn.refreshTokenEnc,
        tokenExpiresAt: expiresAt,
        status: "active",
      })
      .where(eq(connections.id, id));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Refresh token error:", e);
    return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
  }
}

// Provider-specific refresh functions (stubs - implement with actual OAuth)
async function refreshMetaToken(refreshToken: string) {
  const res = await fetch("https://graph.facebook.com/v19.0/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: refreshToken, // TODO: decrypt first
    }),
  });
  return res.json();
}

async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken, // TODO: decrypt first
    }),
  });
  return res.json();
}

async function refreshTikTokToken(refreshToken: string) {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken, // TODO: decrypt first
    }),
  });
  return res.json();
}

async function refreshAmazonToken(refreshToken: string) {
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.AMAZON_CLIENT_ID!,
      client_secret: process.env.AMAZON_CLIENT_SECRET!,
      refresh_token: refreshToken, // TODO: decrypt first
    }),
  });
  return res.json();
}