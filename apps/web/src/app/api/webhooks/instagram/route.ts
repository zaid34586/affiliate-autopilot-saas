import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { connections, dmTriggers, dmMessages, characters } from "@aa/db";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

const META_APP_SECRET = process.env.META_APP_SECRET!;

function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", META_APP_SECRET)
    .update(payload)
    .digest("hex");
  return `sha256=${expectedSignature}` === signature;
}

function extractKeywords(text: string, keywordSet: string[], semantic: boolean): string | null {
  const lower = text.toLowerCase();
  
  // Exact keyword match
  for (const kw of keywordSet) {
    if (lower.includes(kw.toLowerCase())) {
      return kw;
    }
  }
  
  // Semantic matching (simplified)
  if (semantic) {
    const pricePhrases = ["how much", "price", "cost", "kitne", "kaisa", "rate"];
    const linkPhrases = ["link", "url", "where to buy", "buy link", "purchase"];
    const buyPhrases = ["buy", "purchase", "order", "get it", "want this"];
    
    for (const phrase of [...pricePhrases, ...linkPhrases, ...buyPhrases]) {
      if (lower.includes(phrase)) {
        return phrase;
      }
    }
  }
  
  return null;
}

function generateLinkCode(): string {
  return crypto.randomBytes(6).toString("base64url");
}

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}

async function checkCooldown(workspaceId: string, recipientHandle: string, cooldownHours: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  
  const recent = await db
    .select()
    .from(dmMessages)
    .where(
      and(
        eq(dmMessages.workspaceId, workspaceId),
        eq(dmMessages.recipientHandle, recipientHandle),
        sql`${dmMessages.createdAt} > ${cutoff.toISOString()}`
      )
    )
    .limit(1);
  
  return recent.length === 0;
}

async function checkDailyCap(workspaceId: string, dailyCap: number): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(dmMessages)
    .where(
      and(
        eq(dmMessages.workspaceId, workspaceId),
        sql`${dmMessages.createdAt} >= ${today.toISOString()}`
      )
    );
  
  return (count[0]?.count || 0) < dailyCap;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const payload = await req.text();
  
  if (!signature || !verifySignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle comment events
  if (event.object === "instagram" && event.entry) {
    for (const entry of event.entry) {
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "comments" && change.value) {
            const comment = change.value;
            const commentText = comment.text || "";
            const commentId = comment.id;
            const fromUser = comment.from;
            const mediaId = comment.media?.id;
            
            // Find matching triggers
            const triggers = await db
              .select()
              .from(dmTriggers)
              .where(
                and(
                  eq(dmTriggers.enabled, true),
                  sql`${dmTriggers.postId} IS NULL OR ${dmTriggers.postId} = ${mediaId || "NULL"}`
                )
              );

            for (const trigger of triggers) {
              if (!trigger.keywords) continue;
              const matchedKeyword = extractKeywords(commentText, trigger.keywords.set, trigger.keywords.semantic ?? false);
              
              if (!matchedKeyword) continue;
              
              // Check cooldown
              const recipientHandle = fromUser?.username;
              if (!recipientHandle) continue;
              
              const cooldownOk = await checkCooldown(trigger.workspaceId, recipientHandle, trigger.cooldownHours ?? 24);
              if (!cooldownOk) continue;
              
              // Check daily cap
              const capOk = await checkDailyCap(trigger.workspaceId, trigger.dailyCap ?? 50);
              if (!capOk) continue;
              
              // Check sentiment (skip negative)
              // TODO: implement sentiment analysis
              
              // Get connection for DM
              const conn = await db
                .select()
                .from(connections)
                .where(
                  and(
                    eq(connections.workspaceId, trigger.workspaceId),
                    eq(connections.provider, "instagram"),
                    eq(connections.status, "active")
                  )
                )
                .limit(1);
              
              if (!conn.length) continue;
              
              // Get character for this workspace
              const char = await db
                .select()
                .from(characters)
                .where(eq(characters.workspaceId, trigger.workspaceId))
                .limit(1);
              
              const characterName = char[0]?.name || "Assistant";
              
              // Generate unique link code
              const linkCode = generateLinkCode();
              
              // Render DM body
              const dmBody = renderTemplate(trigger.replyTemplate ?? "", {
                link: `https://go.affiliateautopilot.app/${linkCode}`,
                product: "product name", // TODO: get from postId
                price: "$XX.XX", // TODO: get from product
              });
              
              // Create DM message
              await db.insert(dmMessages).values({
                workspaceId: trigger.workspaceId,
                characterId: char[0]?.id || null,
                platform: "instagram",
                channel: "dm",
                recipientHandle,
                triggerKeyword: matchedKeyword,
                postId: mediaId || null,
                body: dmBody,
                uniqueLinkCode: linkCode,
                status: trigger.mode === "auto" ? "queued" : "draft",
                approvalMode: trigger.mode,
              });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}

// Health check
export async function GET() {
  return NextResponse.json({ status: "ok", service: "instagram-webhook" });
}