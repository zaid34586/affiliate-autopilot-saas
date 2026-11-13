import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateScript, VIDEO_MODES, type VideoMode } from "@/lib/video/scripts";
import { splitScriptIntoScenes } from "@/lib/video/scenes";
import { products } from "@aa/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * POST /api/dashboard/videos/script
 * Preview step: product → script + 5–6 scenes (before queuing a render).
 * Body: { productId: string, mode: "showcase" | "listicle" }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const mode = body?.mode as VideoMode;
    const productId = body?.productId as string | undefined;

    if (!VIDEO_MODES.includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Supported modes: showcase, listicle." },
        { status: 400 }
      );
    }
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const rows = await db
      .select({
        id: products.id,
        title: products.title,
        price: products.price,
        currency: products.currency,
        category: products.category,
        rating: products.rating,
        reviewCount: products.reviewCount,
      })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.workspaceId, workspaceId)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const product = rows[0];

    const script = generateScript(
      {
        title: product.title,
        price: product.price,
        currency: product.currency,
        category: product.category,
        rating: product.rating,
        reviewCount: product.reviewCount,
      },
      mode
    );
    const { scenes, totalDurationSec } = splitScriptIntoScenes(script, product.title);

    return NextResponse.json({
      productId: product.id,
      productTitle: product.title,
      script,
      scenes,
      totalDurationSec,
      sceneCount: scenes.length,
    });
  } catch (e) {
    console.error("Video script preview error:", e);
    return NextResponse.json({ error: "Failed to generate script preview" }, { status: 500 });
  }
}
