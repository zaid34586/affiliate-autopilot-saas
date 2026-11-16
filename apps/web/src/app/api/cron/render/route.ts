import { runRenderLoop } from "@/lib/video/worker";
import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron-auth";

/**
 * /api/cron/render — render worker entry point.
 * Claims queued videos (FOR UPDATE SKIP LOCKED) and renders up to 10 in
 * parallel. GET (Vercel Cron default) and POST both run the loop; both are
 * authorized with the shared CRON_SECRET (Authorization: Bearer … or
 * x-cron-secret). Local dev works without the secret; production fails closed.
 */
export const maxDuration = 300; // long-running renders (Pro plans raise serverless limits)

export async function GET(req: Request) {
  return runRenderCron(req);
}

export async function POST(req: Request) {
  return runRenderCron(req);
}

async function runRenderCron(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;

  try {
    const summary = await runRenderLoop({ maxJobs: 10, concurrency: 10 });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("Cron render error:", e);
    return NextResponse.json({ error: "Render loop failed" }, { status: 500 });
  }
}
