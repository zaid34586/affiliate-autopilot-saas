import { auth } from "@/auth";
import { db } from "@/lib/db";
import { connections } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

interface ConnectionStatus {
  provider: string;
  connected: boolean;
  account_name: string | undefined;
  status: string;
  expires_at: string | null | undefined;
  scopes: string[] | null | undefined;
  health: "healthy" | "warning" | "error";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const conns = await db
      .select()
      .from(connections)
      .where(eq(connections.workspaceId, workspaceId));

    // Build status map for UI
    const statuses: Record<string, ConnectionStatus> = {};
    for (const conn of conns) {
      let health: "healthy" | "warning" | "error" = "healthy";
      if (conn.status === "revoked") health = "error";
      else if (conn.status === "expired") health = "warning";
      else if (conn.tokenExpiresAt) {
        const expires = new Date(conn.tokenExpiresAt).getTime();
        const now = Date.now();
        if (expires - now < 7 * 24 * 60 * 60 * 1000) health = "warning"; // < 7 days
      }

      const expiresAt = conn.tokenExpiresAt ? conn.tokenExpiresAt.toISOString() : null;
      const scopes = conn.scopes ?? null;

      statuses[conn.provider] = {
        provider: conn.provider,
        connected: conn.status === "active",
        account_name: conn.accountName ?? undefined,
        status: conn.status,
        expires_at: expiresAt,
        scopes: scopes,
        health,
      };
    }

    return NextResponse.json({ connections: conns, statuses });
  } catch (e) {
    console.error("Fetch connections error:", e);
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }
}