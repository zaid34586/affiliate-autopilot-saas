import { auth } from "@/auth";
import { db } from "@/lib/db";
import { products } from "@aa/db";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET  /api/dashboard/products — active products for the video engine selector.
 * POST /api/dashboard/products — manual quick-add: { title, price?, currency?, category?,
 *        rating?, reviewCount?, imageUrl? } (source = "custom").
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const rows = await db
      .select({
        id: products.id,
        title: products.title,
        price: products.price,
        currency: products.currency,
        category: products.category,
        rating: products.rating,
        reviewCount: products.reviewCount,
        imageUrl: products.imageUrl,
        aiScore: products.aiScore,
        source: products.source,
      })
      .from(products)
      .where(and(eq(products.workspaceId, workspaceId), eq(products.status, "active")))
      .orderBy(desc(products.firstSeenAt))
      .limit(100);

    return NextResponse.json({ products: rows });
  } catch (e) {
    console.error("List products error:", e);
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 });
  }
}

function parseOptionalNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number.`);
  return n;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const title = String(body?.title ?? "").trim();
    const currency = String(body?.currency ?? "USD").trim() || "USD";
    const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : null;

    if (title.length < 2 || title.length > 200) {
      return NextResponse.json(
        { error: "Product title must be 2–200 characters." },
        { status: 400 }
      );
    }

    const price = parseOptionalNumber(body?.price, "Price");
    const rating = parseOptionalNumber(body?.rating, "Rating");
    const reviewCount = parseOptionalNumber(body?.reviewCount, "Review count");

    if (price !== null && price < 0) {
      return NextResponse.json({ error: "Price cannot be negative." }, { status: 400 });
    }
    if (rating !== null && (rating < 0 || rating > 5)) {
      return NextResponse.json({ error: "Rating must be between 0 and 5." }, { status: 400 });
    }
    if (reviewCount !== null && reviewCount < 0) {
      return NextResponse.json({ error: "Review count cannot be negative." }, { status: 400 });
    }

    const [created] = await db
      .insert(products)
      .values({
        workspaceId,
        source: "custom",
        title,
        imageUrl,
        price: price !== null ? String(price.toFixed(2)) : null,
        currency,
        category: body?.category ? String(body.category).trim().slice(0, 80) : null,
        rating: rating !== null ? String(rating.toFixed(2)) : null,
        reviewCount: reviewCount !== null ? Math.round(reviewCount) : null,
      })
      .returning({ id: products.id, title: products.title });

    return NextResponse.json({ success: true, product: created }, { status: 201 });
  } catch (e) {
    console.error("Create product error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create product" },
      { status: 500 }
    );
  }
}
