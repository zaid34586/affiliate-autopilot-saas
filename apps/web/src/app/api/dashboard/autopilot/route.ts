import { auth } from "@/auth";
import { db } from "@/lib/db";
import { autopilotConfig } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

interface AutopilotConfig {
  level: "manual" | "semi" | "full" | "fire_and_forget";
  dailyPostLimits: Record<string, number>;
  activePlatforms: string[];
  quietHours: { from: string; to: string };
  paused: boolean;
  circuitBreakers: {
    maxErrorsPerHour: number;
    maxRetries: number;
    pauseOnRateLimit: boolean;
  };
}

const DEFAULT_CONFIG: AutopilotConfig = {
  level: "semi",
  dailyPostLimits: { instagram: 3, youtube: 2, tiktok: 3, facebook: 2, x: 5 },
  activePlatforms: ["instagram", "youtube"],
  quietHours: { from: "22:00", to: "08:00" },
  paused: false,
  circuitBreakers: {
    maxErrorsPerHour: 10,
    maxRetries: 3,
    pauseOnRateLimit: true,
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
      .from(autopilotConfig)
      .where(eq(autopilotConfig.workspaceId, workspaceId))
      .limit(1);

    if (!existing.length) {
      // Create default config
      await db.insert(autopilotConfig).values({
        workspaceId,
        level: "semi",
        dailyPostLimits: DEFAULT_CONFIG.dailyPostLimits,
        activePlatforms: DEFAULT_CONFIG.activePlatforms,
        quietHours: DEFAULT_CONFIG.quietHours,
        paused: false,
      });

      return NextResponse.json({ config: DEFAULT_CONFIG });
    }

    const cfg = existing[0];

    const config: AutopilotConfig = {
      level: cfg.level as AutopilotConfig["level"],
      dailyPostLimits: (cfg.dailyPostLimits as Record<string, number>) || DEFAULT_CONFIG.dailyPostLimits,
      activePlatforms: (cfg.activePlatforms as string[]) || DEFAULT_CONFIG.activePlatforms,
      quietHours: (cfg.quietHours as { from: string; to: string }) || DEFAULT_CONFIG.quietHours,
      paused: cfg.paused ?? false,
      circuitBreakers: (cfg.circuitBreakers as AutopilotConfig["circuitBreakers"]) || DEFAULT_CONFIG.circuitBreakers,
    };

    return NextResponse.json({ config });
  } catch (e) {
    console.error("Fetch autopilot config error:", e);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
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
    const {
      level,
      dailyPostLimits,
      activePlatforms,
      quietHours,
      paused,
      circuitBreakers,
    } = body as Partial<AutopilotConfig>;

    // Validate level
    if (level && !["manual", "semi", "full", "fire_and_forget"].includes(level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    // Validate quiet hours
    if (quietHours) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(quietHours.from) || !timeRegex.test(quietHours.to)) {
        return NextResponse.json({ error: "Invalid time format (HH:MM)" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (level) updateData.level = level;
    if (dailyPostLimits) updateData.dailyPostLimits = dailyPostLimits;
    if (activePlatforms) updateData.activePlatforms = activePlatforms;
    if (quietHours) updateData.quietHours = quietHours;
    if (typeof paused === "boolean") updateData.paused = paused;
    if (circuitBreakers) updateData.circuitBreakers = circuitBreakers;

    await db
      .insert(autopilotConfig)
      .values({
        workspaceId,
        level: level ?? "semi",
        dailyPostLimits: dailyPostLimits ?? DEFAULT_CONFIG.dailyPostLimits,
        activePlatforms: activePlatforms ?? DEFAULT_CONFIG.activePlatforms,
        quietHours: quietHours ?? DEFAULT_CONFIG.quietHours,
        paused: paused ?? false,
        circuitBreakers: circuitBreakers ?? DEFAULT_CONFIG.circuitBreakers,
      })
      .onConflictDoUpdate({
        target: autopilotConfig.workspaceId,
        set: updateData,
      });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Save autopilot config error:", e);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}