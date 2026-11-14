/**
 * Phase 5 Module C — Character chat (user se discuss).
 * GET: chat history (persisted in characters.memory.chat).
 * POST: { message } → character reply with reasoning (rules-v1 engine).
 */
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { characters } from "@aa/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { discussWithCharacter } from "@/lib/character/discuss";

interface ChatMessage {
  role: "user" | "character";
  content: string;
  at: string;
}

const MAX_MESSAGE_LEN = 500;
const MAX_HISTORY = 20;

async function loadHistory(workspaceId: string): Promise<ChatMessage[]> {
  const [character] = await db
    .select({ memory: characters.memory })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);

  const memory = (character?.memory ?? {}) as Record<string, unknown>;
  const chat = Array.isArray(memory.chat) ? (memory.chat as ChatMessage[]) : [];
  return chat;
}

async function saveHistory(
  workspaceId: string,
  chat: ChatMessage[],
): Promise<void> {
  const [character] = await db
    .select({ id: characters.id, memory: characters.memory })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId))
    .limit(1);
  if (!character) return;

  const memory = { ...(character.memory ?? {}) } as Record<string, unknown>;
  memory.chat = chat.slice(-MAX_HISTORY);
  await db
    .update(characters)
    .set({ memory })
    .where(eq(characters.id, character.id));
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const chat = await loadHistory(session.user.workspaceId);
    return NextResponse.json({ chat });
  } catch (e) {
    console.error("Character chat GET error:", e);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = session.user.workspaceId;

  let message = "";
  try {
    const body = await req.json();
    message = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LEN} characters)` },
      { status: 400 },
    );
  }

  try {
    const result = await discussWithCharacter(workspaceId, message);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    const history = await loadHistory(workspaceId);
    history.push({
      role: "user",
      content: message,
      at: new Date().toISOString(),
    });
    history.push({
      role: "character",
      content: result.reply,
      at: new Date().toISOString(),
    });
    await saveHistory(workspaceId, history);

    return NextResponse.json({ result, chat: history.slice(-MAX_HISTORY) });
  } catch (e) {
    console.error("Character chat POST error:", e);
    return NextResponse.json(
      { error: "Failed to generate reply" },
      { status: 500 },
    );
  }
}
