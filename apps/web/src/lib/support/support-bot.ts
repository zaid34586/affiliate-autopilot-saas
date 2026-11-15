/**
 * Phase 7 — AI Support Bot Orchestration.
 *
 * Wires the bot into the support ticket flow:
 * - autoReplyOnNewTicket: runs bot when ticket created, posts reply if confident
 * - processInboundEmail: creates ticket from email, triggers bot
 */

import { db } from "@/lib/db";
import { supportTickets, ticketMessages, users, workspaceMembers } from "@aa/db";
import { eq, and, desc } from "drizzle-orm";
import { runSupportBot, SupportBotInput, isLikelySupportQuestion } from "./support-bot-core";
import { buildKbContextForMessage } from "@/lib/knowledge/knowledge";
import { createSupportTicket } from "@/lib/help/support-tickets";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@affiliateautopilot.app";

/**
 * When a new ticket is created, run the support bot and post an auto-reply
 * if the bot is confident. Called from the ticket creation flow.
 */
export async function autoReplyOnNewTicket(
  ticketId: string,
  workspaceId: string,
  userId: string,
): Promise<{ replied: boolean; confidence?: number }> {
  // Fetch ticket + user
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.workspaceId, workspaceId)))
    .limit(1);

  if (!ticket) return { replied: false };

  // Build KB context from the user's question
  const question = `${ticket.subject}\n\n${ticket.descriptionMd}`;
  const kbContext = await buildKbContextForMessage(workspaceId, question);

  // Run bot
  const botResult = await runSupportBot({
    question,
    kbContext,
    userTier: "starter", // TODO: lookup from subscription
  });

  if (!botResult.shouldAutoReply) {
    return { replied: false, confidence: botResult.confidence };
  }

  // Post auto-reply as a staff message
  await db.insert(ticketMessages).values({
    ticketId,
    userId: "system-support-bot",
    isStaff: true,
    bodyMd: `🤖 **Auto-reply from Support Bot** (confidence: ${botResult.confidence}%)\n\n${botResult.answer}\n\n---\n*This is an automated response. If this doesn't solve your issue, reply and a human will take over.*`,
    isInternal: false,
  });

  // Update ticket: add bot tag, keep status open
  await db
    .update(supportTickets)
    .set({
      tags: [...(ticket.tags || []), "auto-replied"],
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, ticketId));

  return { replied: true, confidence: botResult.confidence };
}

/**
 * Process an inbound support email (from Resend webhook or similar).
 * Creates a ticket and triggers the bot.
 */
export async function processInboundEmail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId: string;
}): Promise<{ ticketId: string; botReplied: boolean }> {
  const email = input.from.toLowerCase().trim();

  // Find user by email + their workspace (via workspaceMembers)
  const [user] = await db
    .select({
      id: users.id,
      workspaceId: workspaceMembers.workspaceId,
    })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Unknown user → create a generic ticket anyway
    const ticket = await createSupportTicket({
      workspaceId: "00000000-0000-0000-0000-000000000000", // placeholder, or create temp workspace
      userId: "00000000-0000-0000-0000-000000000000",
      subject: input.subject || "Inbound email (unknown user)",
      descriptionMd: `From: ${email}\n\n${input.text}`,
      category: "general",
      priority: "medium",
    });
    return { ticketId: ticket.id, botReplied: false };
  }

  // Create ticket
  const ticket = await createSupportTicket({
    workspaceId: user.workspaceId!,
    userId: user.id,
    subject: input.subject || "Inbound email",
    descriptionMd: input.text,
    category: "general",
    priority: "medium",
    tags: ["email"],
  });

  // Trigger auto-reply
  const bot = await autoReplyOnNewTicket(ticket.id, user.workspaceId!, user.id);

  return { ticketId: ticket.id, botReplied: bot.replied };
}

/**
 * Quick check: should we even run the bot for this question?
 * (Used to skip obvious non-support messages)
 */
export function shouldRunBot(subject: string, body: string): boolean {
  const combined = `${subject} ${body}`.toLowerCase();
  return isLikelySupportQuestion(combined);
}

/**
 * Send a bot reply notification email to the user (when auto-reply posted).
 */
export async function notifyUserOfBotReply(
  userEmail: string,
  ticketSubject: string,
  botAnswer: string,
): Promise<void> {
  // In production, use the email transport
  // For now, console log
  console.log(`[SupportBot] Would notify ${userEmail} about bot reply on "${ticketSubject}"`);
  // await sendEmail({
  //   to: userEmail,
  //   subject: `Re: ${ticketSubject} — Auto-reply from Support Bot`,
  //   html: `...`,
  //   text: `...`,
  // });
}