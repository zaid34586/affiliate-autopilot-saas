/**
 * Phase 7 — Help Center Core (pure logic).
 * 
 * Help Center: articles, categories, search, feedback
 * Changelog: version entries, categories
 * Announcements: targeting, scheduling, dismissals
 * Support Tickets: lifecycle, messages, SLA
 */

export interface HelpArticle {
  id: string;
  workspaceId: string | null;
  slug: string;
  title: string;
  description: string | null;
  contentMd: string;
  contentHtml: string | null;
  category: string;
  tags: string[];
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  authorId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export interface HelpArticleFeedback {
  id: string;
  articleId: string;
  workspaceId: string;
  userId: string | null;
  isHelpful: boolean;
  comment: string | null;
  createdAt: Date;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string | null;
  releaseDate: Date;
  categories: string[];
  items: Array<{
    type: "feature" | "fix" | "improvement" | "breaking" | "security";
    title: string;
    description: string;
  }>;
  isPublished: boolean;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Announcement {
  id: string;
  workspaceId: string | null;
  title: string;
  bodyMd: string;
  bodyHtml: string | null;
  type: "info" | "warning" | "success" | "maintenance" | "feature";
  priority: number;
  targetRoles: string[];
  targetWorkspaces: string[];
  startAt: Date;
  endAt: Date | null;
  isDismissible: boolean;
  ctaText: string | null;
  ctaUrl: string | null;
  isPublished: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportTicket {
  id: string;
  workspaceId: string;
  userId: string;
  subject: string;
  descriptionMd: string;
  category: "technical" | "billing" | "feature_request" | "bug_report" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  assignedTo: string | null;
  tags: string[];
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  satisfactionRating: number | null;
  satisfactionFeedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string | null;
  isStaff: boolean;
  bodyMd: string;
  bodyHtml: string | null;
  isInternal: boolean;
  createdAt: Date;
}

/**
 * Help Center Categories
 */
export const HELP_CATEGORIES = [
  { key: "getting_started", label: "Getting Started", description: "Onboarding, setup, first steps", icon: "rocket", order: 1 },
  { key: "billing", label: "Billing & Subscription", description: "Plans, payments, invoices, cancellation", icon: "credit-card", order: 2 },
  { key: "video", label: "Video Engine", description: "Rendering, formats, providers, costs", icon: "video", order: 3 },
  { key: "dm_engine", label: "DM Sales Engine", description: "Funnels, triggers, replies, automation", icon: "message-square", order: 4 },
  { key: "troubleshooting", label: "Troubleshooting", description: "Common issues, errors, fixes", icon: "wrench", order: 5 },
  { key: "api", label: "API & Integrations", description: "Webhooks, API keys, developer docs", icon: "code", order: 6 },
  { key: "guides", label: "Guides & Tutorials", description: "Step-by-step walkthroughs", icon: "book-open", order: 7 },
] as const;

export type HelpCategoryKey = typeof HELP_CATEGORIES[number]["key"];

/**
 * Changelog Categories
 */
export const CHANGELOG_CATEGORIES = [
  { key: "feature", label: "New Features", color: "green" },
  { key: "improvement", label: "Improvements", color: "blue" },
  { key: "fix", label: "Bug Fixes", color: "red" },
  { key: "breaking", label: "Breaking Changes", color: "orange" },
  { key: "security", label: "Security", color: "purple" },
  { key: "deprecated", label: "Deprecated", color: "gray" },
] as const;

export type ChangelogCategoryKey = typeof CHANGELOG_CATEGORIES[number]["key"];

/**
 * Announcement Types
 */
export const ANNOUNCEMENT_TYPES = [
  { key: "info", label: "Information", color: "blue" },
  { key: "warning", label: "Warning", color: "yellow" },
  { key: "success", label: "Success", color: "green" },
  { key: "maintenance", label: "Maintenance", color: "orange" },
  { key: "feature", label: "New Feature", color: "purple" },
] as const;

export type AnnouncementTypeKey = typeof ANNOUNCEMENT_TYPES[number]["key"];

/**
 * Support Ticket Categories
 */
export const TICKET_CATEGORIES = [
  { key: "technical", label: "Technical Issue", description: "Errors, bugs, performance problems" },
  { key: "billing", label: "Billing & Payments", description: "Invoices, refunds, subscription changes" },
  { key: "feature_request", label: "Feature Request", description: "New functionality ideas" },
  { key: "bug_report", label: "Bug Report", description: "Something isn't working correctly" },
  { key: "general", label: "General Question", description: "How-to, clarification, other" },
] as const;

export type TicketCategoryKey = typeof TICKET_CATEGORIES[number]["key"];

/**
 * Search help articles
 */
export function searchHelpArticles(
  articles: HelpArticle[],
  query: string,
  options: {
    category?: string;
    workspaceId?: string;
    includeUnpublished?: boolean;
    limit?: number;
  } = {}
): HelpArticle[] {
  const { category, workspaceId, includeUnpublished = false, limit = 20 } = options;
  const lowerQuery = query.toLowerCase();

  let filtered = articles.filter(a => {
    if (!includeUnpublished && !a.isPublished) return false;
    if (workspaceId !== undefined && a.workspaceId !== workspaceId && a.workspaceId !== null) return false;
    if (category && a.category !== category) return false;
    
    const searchText = `${a.title} ${a.description || ""} ${a.contentMd} ${a.tags.join(" ")}`.toLowerCase();
    return searchText.includes(lowerQuery);
  });

  // Sort by relevance (title match > description match > content match)
  filtered.sort((a, b) => {
    const aTitle = a.title.toLowerCase().includes(lowerQuery);
    const bTitle = b.title.toLowerCase().includes(lowerQuery);
    if (aTitle && !bTitle) return -1;
    if (!aTitle && bTitle) return 1;
    
    const aDesc = a.description?.toLowerCase().includes(lowerQuery) || false;
    const bDesc = b.description?.toLowerCase().includes(lowerQuery) || false;
    if (aDesc && !bDesc) return -1;
    if (!aDesc && bDesc) return 1;
    
    return b.viewCount - a.viewCount; // Popular first
  });

  return filtered.slice(0, limit);
}

/**
 * Get related articles
 */
export function getRelatedArticles(
  article: HelpArticle,
  allArticles: HelpArticle[],
  limit = 5
): HelpArticle[] {
  return allArticles
    .filter(a => 
      a.id !== article.id && 
      a.isPublished &&
      (a.category === article.category || a.tags.some(t => article.tags.includes(t)))
    )
    .sort((a, b) => {
      // Same category first
      const aSameCat = a.category === article.category;
      const bSameCat = b.category === article.category;
      if (aSameCat && !bSameCat) return -1;
      if (!aSameCat && bSameCat) return 1;
      return b.viewCount - a.viewCount;
    })
    .slice(0, limit);
}

/**
 * Validate article slug
 */
export function validateSlug(slug: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!slug || slug.trim().length === 0) {
    errors.push("Slug is required");
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.push("Slug must be lowercase alphanumeric with hyphens only");
  }
  if (slug.length > 100) {
    errors.push("Slug too long (max 100 characters)");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

/**
 * Render markdown to HTML (simple version - use a proper library in production)
 */
export function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<p><h([1-3])>/g, "<h$1>")
    .replace(/<\/h([1-3])><\/p>/g, "</h$1>")
    .replace(/<p><pre>/g, "<pre>")
    .replace(/<\/pre><\/p>/g, "</pre>")
    .replace(/<p><br>/g, "<br>");
}

/**
 * Validate ticket data
 */
export function validateTicket(data: Partial<SupportTicket>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data.subject || data.subject.trim().length < 5) {
    errors.push("Subject must be at least 5 characters");
  }
  if (!data.descriptionMd || data.descriptionMd.trim().length < 10) {
    errors.push("Description must be at least 10 characters");
  }
  if (data.category && !["technical", "billing", "feature_request", "bug_report", "general"].includes(data.category)) {
    errors.push("Invalid category");
  }
  if (data.priority && !["low", "medium", "high", "urgent"].includes(data.priority)) {
    errors.push("Invalid priority");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Calculate ticket SLA based on priority
 */
export function getTicketSLA(priority: "low" | "medium" | "high" | "urgent"): { firstResponseHours: number; resolutionHours: number } {
  switch (priority) {
    case "urgent": return { firstResponseHours: 1, resolutionHours: 4 };
    case "high": return { firstResponseHours: 4, resolutionHours: 24 };
    case "medium": return { firstResponseHours: 24, resolutionHours: 72 };
    case "low": return { firstResponseHours: 48, resolutionHours: 168 }; // 1 week
    default: return { firstResponseHours: 24, resolutionHours: 72 };
  }
}

/**
 * Check if announcement is active for user
 */
export function isAnnouncementActive(
  announcement: Announcement,
  user: { workspaceId: string; role: string },
  now = new Date()
): boolean {
  if (!announcement.isPublished) return false;
  if (now < announcement.startAt) return false;
  if (announcement.endAt && now > announcement.endAt) return false;
  
  // Check workspace targeting
  if (announcement.targetWorkspaces.length > 0 && 
      !announcement.targetWorkspaces.includes(user.workspaceId)) {
    return false;
  }
  
  // Check role targeting
  if (announcement.targetRoles.length > 0 && 
      !announcement.targetRoles.includes("all") &&
      !announcement.targetRoles.includes("any")) {
    // Would need actual role check here
  }
  
  return true;
}