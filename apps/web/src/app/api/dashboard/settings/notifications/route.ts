import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notificationPreferences } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const DEFAULT_PREFS = {
  email: {
    dailyReport: true,
    weeklyReport: true,
    autopilotErrors: true,
    billingAlerts: true,
    newFeatures: false,
  },
  inApp: {
    autopilotStatus: true,
    dmReplies: true,
    conversionAlerts: true,
  },
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.workspaceId, workspaceId))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ prefs: DEFAULT_PREFS });
    }

    const n = existing[0];
    return NextResponse.json({
      prefs: {
        email: (n.emailPrefs as typeof DEFAULT_PREFS.email) ?? DEFAULT_PREFS.email,
        inApp: (n.inAppPrefs as typeof DEFAULT_PREFS.inApp) ?? DEFAULT_PREFS.inApp,
      },
    });
  } catch (e) {
    console.error("Fetch notification prefs error:", e);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const { email, inApp } = body as { email?: typeof DEFAULT_PREFS.email; inApp?: typeof DEFAULT_PREFS.inApp };

    const updateData: Record<string, unknown> = {};
    if (email) updateData.emailPrefs = email;
    if (inApp) updateData.inAppPrefs = inApp;

    await db
      .insert(notificationPreferences)
      .values({
        workspaceId,
        emailPrefs: email ?? DEFAULT_PREFS.email,
        inAppPrefs: inApp ?? DEFAULT_PREFS.inApp,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.workspaceId,
        set: updateData,
      });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Save notification prefs error:", e);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}