import { runRenderLoop } from "@/lib/video/worker";
import { NextResponse } from "next/server";

/**
 * POST /api/cron/render — render worker entry point.
 * Claims queued videos (FOR UPDATE SKIP LOCKED) and renders up to 10 in
 * parallel. Trigger by external cron / Vercel cron / the Docker worker with:
 *   Header: x-cron-secret: $RENDER_CRON_SECRET
 * Local dev: works without the secret when RENDER_CRON_SECRET is unset.
 */
export const maxDuration = 300; // long-running renders (Pro plans raise serverless limits)

export async function POST(req: Request) {
  const secret = process.env.RENDER_CRON_SECRET?.trim();
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (secret) {
    if (provided !== secret) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "RENDER_CRON_SECRET not configured" }, { status: 503 });
  }

  try {
    const summary = await runRenderLoop({ maxJobs: 10, concurrency: 10 });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("Cron render error:", e);
    return NextResponse.json({ error: "Render loop failed" }, { status: 500 });
  }
}
