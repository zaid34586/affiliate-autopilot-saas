/**
 * Phase 7 — Templates Library API
 * GET  /api/dashboard/templates         - list (filters: niche, format, q, builtin, limit)
 * POST /api/dashboard/templates         - create custom template
 * GET  /api/dashboard/templates?recommend=<niche> - top templates for a niche
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listTemplates, createCustomTemplate, getRecommendations } from "@/lib/templates/templates";
import { TEMPLATE_NICHES, TEMPLATE_FORMATS } from "@/lib/templates/templates-core";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const { searchParams } = new URL(req.url);

  try {
    // Recommendation rail: ?recommend=<niche>
    const recommend = searchParams.get("recommend");
    if (recommend) {
      if (!(TEMPLATE_NICHES as readonly string[]).includes(recommend)) {
        return NextResponse.json({ error: "Invalid niche" }, { status: 400 });
      }
      const templates = await getRecommendations(recommend, 4);
      return NextResponse.json({ templates });
    }

    const niche = searchParams.get("niche") ?? undefined;
    const format = searchParams.get("format") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const builtin = searchParams.get("builtin");
    const limit = searchParams.get("limit");

    if (niche && !(TEMPLATE_NICHES as readonly string[]).includes(niche)) {
      return NextResponse.json({ error: "Invalid niche" }, { status: 400 });
    }
    if (format && !(TEMPLATE_FORMATS as readonly string[]).includes(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const templates = await listTemplates(workspaceId, {
      niche,
      format,
      q: q ?? undefined,
      builtin: builtin === null || builtin === undefined ? undefined : builtin === "true",
      limit: limit ? Math.min(200, parseInt(limit, 10) || 100) : undefined,
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("List templates error:", error);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: {
    niche?: string;
    format?: string;
    title?: string;
    description?: string;
    body?: string;
    tags?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await createCustomTemplate({
      workspaceId,
      createdBy: session.user.id,
      template: {
        niche: body.niche ?? "",
        format: body.format ?? "",
        title: body.title ?? "",
        description: body.description ?? "",
        body: body.body ?? "",
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
      },
    });

    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }

    return NextResponse.json({ template: result.template }, { status: 201 });
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
