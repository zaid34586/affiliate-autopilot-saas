/**
 * Phase 4 S6 — Publisher types (auto-post reels: IG Reels / YouTube Shorts).
 * TikTok is intentionally absent until its content audit is done (ROADMAP P4).
 */

export const PUBLISH_PLATFORMS = ["instagram", "youtube"] as const;
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

export const PLATFORM_LABELS: Record<PublishPlatform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
};

export function isPublishPlatform(value: unknown): value is PublishPlatform {
  return typeof value === "string" && (PUBLISH_PLATFORMS as readonly string[]).includes(value);
}

export interface BuiltCaption {
  /** YouTube title / Instagram fallback (platform-capped by the builder). */
  title: string;
  /** YouTube description / Instagram caption. */
  body: string;
}

export interface PublishInput {
  workspaceId: string;
  videoId: string;
  platform: PublishPlatform;
  caption: BuiltCaption;
  /** Local path of the rendered 9:16 MP4 (storage resolved by the caller). */
  videoAbsPath: string;
  /**
   * Publicly fetchable URL for the same file — required by Instagram's
   * Content Publish API (Meta servers download the video themselves).
   */
  videoUrl?: string;
  /** OAuth access token from the workspace's active connection. */
  accessToken: string;
  /** Platform account id (IG user id / YouTube channel id) from the connection. */
  accountId: string | null;
}

export interface PublishResult {
  platformPostId: string;
  permalink: string | null;
}

export interface Publisher {
  platform: PublishPlatform;
  publish(input: PublishInput): Promise<PublishResult>;
}

/** The workspace has no active connection for this platform (live mode only). */
export class PublishNotAvailableError extends Error {
  readonly needsConnection = true;
  constructor(message: string) {
    super(message);
    this.name = "PublishNotAvailableError";
  }
}
