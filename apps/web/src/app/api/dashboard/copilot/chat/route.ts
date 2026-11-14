/**
 * Phase 6 Module C — AI Copilot API.
 * POST /api/dashboard/copilot/chat - LLM-powered chat with action execution
 * GET /api/dashboard/copilot/chat - Conversation history
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { copilotChat } from "@/lib/copilot/copilot";
import { copilotConversations, copilotMessages } from "@aa/db";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 50;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), MAX_HISTORY);

  try {
    if (conversationId) {
      // Get specific conversation with messages
      const [conv] = await db
        .select()
        .from(copilotConversations)
        .where(eq(copilotConversations.id, conversationId))
        .limit(1);

      if (!conv) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const messages = await db
        .select()
        .from(copilotMessages)
        .where(eq(copilotMessages.conversationId, conversationId))
        .orderBy(desc(copilotMessages.createdAt))
        .limit(limit);

      return NextResponse.json({ conversation: conv, messages: messages.reverse() });
    }

    // List all conversations
    const conversations = await db
      .select()
      .from(copilotConversations)
      .where(eq(copilotConversations.workspaceId, workspaceId))
      .orderBy(desc(copilotConversations.updatedAt))
      .limit(20);

    return NextResponse.json({ conversations });
  } catch (e) {
    console.error("Copilot chat GET error:", e);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let body: { message: string; conversationId?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, conversationId, model } = body;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.trim().length === 0) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LEN} characters)` },
      { status: 400 },
    );
  }

  try {
    const result = await copilotChat(workspaceId, message.trim(), conversationId, model);

    return NextResponse.json({
      result,
      conversationId: conversationId || result.conversationId, // Will be set by copilotChat
    });
  } catch (e) {
    console.error("Copilot chat POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate reply" },
      { status: 500 },
    );
  }
}