/**
 * Phase 7 — Audit Log Core (pure logic).
 * 
 * Structured audit logging for all user + AI actions.
 * Enables compliance, debugging, and security monitoring.
 */

export type ActorType = "user" | "ai" | "system";

export interface AuditLogEntry {
  workspaceId: string;
  userId?: string;
  actorType: ActorType;
  actorId: string; // user ID, AI agent name, system component
  action: string; // e.g., "post.created", "dm.sent", "campaign.launched"
  resourceType?: string; // e.g., "post", "campaign", "dm_message", "video"
  resourceId?: string; // ID of the affected resource
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>; // IP, user agent, request ID, etc.
}

export interface AuditLogQuery {
  workspaceId: string;
  userId?: string;
  actorType?: ActorType;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  id: string;
  workspaceId: string;
  userId: string | null;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Standardized action names for consistency
 */
export const AUDIT_ACTIONS = {
  // Auth
  "auth.login": "User logged in",
  "auth.logout": "User logged out",
  "auth.signup": "User signed up",
  "auth.password_reset": "Password reset requested",
  
  // Workspace
  "workspace.created": "Workspace created",
  "workspace.updated": "Workspace settings updated",
  "workspace.deleted": "Workspace deleted",
  
  // Character
  "character.created": "Character created",
  "character.updated": "Character profile updated",
  "character.voice_cloned": "Voice cloned for character",
  
  // Content
  "content.created": "Content created",
  "content.updated": "Content updated",
  "content.approved": "Content approved",
  "content.published": "Content published",
  "content.failed": "Content generation failed",
  
  // Posts
  "post.created": "Post created",
  "post.updated": "Post updated",
  "post.scheduled": "Post scheduled",
  "post.published": "Post published",
  "post.failed": "Post publishing failed",
  "post.deleted": "Post deleted",
  
  // Campaigns
  "campaign.created": "Campaign created",
  "campaign.launched": "Campaign launched",
  "campaign.completed": "Campaign completed",
  
  // Videos
  "video.created": "Video render job created",
  "video.rendering": "Video rendering started",
  "video.completed": "Video render completed",
  "video.failed": "Video render failed",
  "video.remixed": "Video remixed for new product",
  
  // DM / Messaging
  "dm.sent": "DM sent",
  "dm.replied": "DM reply sent",
  "dm.triggered": "DM auto-triggered",
  "dm.funnel_started": "DM funnel started",
  "dm.funnel_completed": "DM funnel completed",
  
  // WhatsApp
  "whatsapp.link_created": "WhatsApp link created",
  "whatsapp.bot_replied": "WhatsApp bot auto-replied",
  
  // Analytics / Reports
  "report.generated": "Report generated",
  "report.scheduled": "Report scheduled",
  "analytics.synced": "Analytics synced from platform",
  
  // Optimizer
  "optimizer.decision_created": "Optimizer decision created",
  "optimizer.decision_executed": "Optimizer decision executed",
  "optimizer.decision_dismissed": "Optimizer decision dismissed",
  
  // A/B Tests
  "ab_test.created": "A/B test created",
  "ab_test.started": "A/B test started",
  "ab_test.completed": "A/B test completed",
  "ab_test.winner_applied": "A/B test winner applied",
  
  // Feature Flags
  "feature_flag.created": "Feature flag created",
  "feature_flag.updated": "Feature flag updated",
  "feature_flag.rolled_out": "Feature flag rolled out",
  
  // Settings
  "settings.ai_keys_updated": "AI keys updated",
  "settings.autopilot_updated": "Autopilot settings updated",
  "settings.brand_updated": "Brand profile updated",
  "settings.webhook_updated": "Webhook configuration updated",
  
  // Billing
  "billing.subscription_created": "Subscription created",
  "billing.subscription_updated": "Subscription updated",
  "billing.subscription_cancelled": "Subscription cancelled",
  "billing.payment_failed": "Payment failed",
  
  // Team
  "team.member_invited": "Team member invited",
  "team.member_role_changed": "Team member role changed",
  "team.member_removed": "Team member removed",
  
  // AI Actions
  "ai.copilot_message": "AI Copilot message sent",
  "ai.copilot_action": "AI Copilot action executed",
  "ai.research_triggered": "AI research triggered",
  "ai.content_generated": "AI content generated",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/**
 * Validate audit action
 */
export function isValidAuditAction(action: string): action is AuditAction {
  return action in AUDIT_ACTIONS;
}

/**
 * Build metadata from request
 */
export function buildAuditMetadata(request?: Request, extra?: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };
  
  if (request) {
    meta.ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    meta.userAgent = request.headers.get("user-agent") || "unknown";
    meta.requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  }
  
  if (extra) {
    Object.assign(meta, extra);
  }
  
  return meta;
}

/**
 * Sanitize values for audit log (remove sensitive data)
 */
export function sanitizeAuditValues(values: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...values };
  const sensitiveKeys = [
    "password", "token", "secret", "key", "apiKey", "api_key",
    "accessToken", "refreshToken", "authorization", "creditCard",
    "ssn", "cvv", "pin", "privateKey"
  ];
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(s => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    }
  }
  
  return sanitized;
}