/**
 * Phase 4 S6 — Sandbox publisher (dev/demo only, never in production unless
 * PUBLISH_MODE=mock). Simulates the platform round-trip so the full
 * auto-post flow is testable without live OAuth. Posts created through it
 * are stored with sandbox=true and labeled "Sandbox" in the UI — they are
 * never presented as live platform posts.
 */
import type { PublishInput, PublishResult, Publisher } from "./types";

const MOCK_PERMALINKS: Record<string, string | null> = {
  instagram: null, // IG sandbox posts have no public permalink
  youtube: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sandboxPublisher(platform: "instagram" | "youtube"): Publisher {
  return {
    platform,
    async publish(input: PublishInput): Promise<PublishResult> {
      // Simulate platform latency so the UI's "publishing" state is exercised.
      await sleep(400);
      if (!input.caption.body.trim()) {
        throw new Error("Sandbox publish rejected an empty caption.");
      }
      return {
        platformPostId: `sandbox_${platform}_${input.videoId.slice(0, 8)}`,
        permalink: MOCK_PERMALINKS[platform],
      };
    },
  };
}
