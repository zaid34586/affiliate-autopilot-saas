import { describe, expect, it } from "vitest";
import {
  scoreHashtagRelevance,
  scoreAudioRelevance,
  scoreViralPostRemix,
  generateRemixSuggestions,
  getTopHashtagsForNiche,
  getTopAudioForPlatform,
  type TrendAnalysisInput,
  type ProductContext,
  type TrendingHashtag,
  type TrendingAudio,
  type ViralPost,
} from "./trend-core";

const niche = "fitness";
const products: ProductContext[] = [
  { id: "p1", title: "Resistance Bands Pro", niche: "fitness", commissionType: "percentage", commissionValue: "15" },
  { id: "p2", title: "Yoga Mat Premium", niche: "fitness", commissionType: "flat", commissionValue: "10" },
];

function input(overrides: Partial<TrendAnalysisInput> = {}): TrendAnalysisInput {
  return {
    workspaceNiche: niche,
    products,
    trendingHashtags: [
      { id: "tag-1", hashtag: "#fitness", platform: "instagram", volume: 50000, velocity: 15, niche: "fitness" },
      { id: "tag-2", hashtag: "#workout", platform: "tiktok", volume: 30000, velocity: 8, niche: "fitness" },
      { id: "tag-3", hashtag: "#tech", platform: "x", volume: 20000, velocity: 5, niche: "technology" },
    ],
    trendingAudio: [
      { id: "audio-1", audioId: "audio1", platform: "instagram", title: "Workout Beat", artist: "DJ Fit", usageCount: 5000, velocity: 20 },
      { id: "audio-2", audioId: "audio2", platform: "tiktok", title: "Gym Motivation", artist: "Coach Mike", usageCount: 3000, velocity: 10 },
    ],
    viralPosts: [
      {
        id: "viral-1",
        platform: "instagram",
        platformPostId: "post1",
        authorHandle: "fit_influencer",
        caption: "My resistance band routine!",
        hashtags: ["#fitness", "#workout", "#resistancebands"],
        audioId: "audio-1",
        views: 100000,
        likes: 5000,
        comments: 200,
        shares: 100,
        engagementRate: 0.053,
        affiliateLinks: ["go.affiliateautopilot.app/abc123"],
        niche: "fitness",
      },
      {
        id: "viral-2",
        platform: "tiktok",
        platformPostId: "post2",
        authorHandle: "gym_bro",
        caption: "Yoga flow for beginners",
        hashtags: ["#yoga", "#flexibility"],
        audioId: null,
        views: 50000,
        likes: 2000,
        comments: 50,
        shares: 20,
        engagementRate: 0.041,
        affiliateLinks: [],
        niche: "fitness",
      },
    ],
    ...overrides,
  };
}

describe("scoreHashtagRelevance", () => {
  it("scores niche-matching hashtag high", () => {
    const score = scoreHashtagRelevance(
      { id: "tag-1", hashtag: "#fitness", platform: "instagram", volume: 50000, velocity: 15, niche: "fitness" },
      input(),
    );
    // Volume: 30 + Velocity: 3 + Niche: 25 = 58
    expect(score).toBe(58);
  });

  it("scores non-niche hashtag lower", () => {
    const score = scoreHashtagRelevance(
      { id: "tag-2", hashtag: "#tech", platform: "x", volume: 50000, velocity: 15, niche: "technology" },
      input(),
    );
    expect(score).toBeLessThan(50);
  });

  it("boosts score when product keyword in hashtag", () => {
    const withBands = input({
      trendingHashtags: [{ id: "tag-3", hashtag: "#resistancebands", platform: "instagram", volume: 1000, velocity: 5, niche: "fitness" }],
    });
    const score = scoreHashtagRelevance(
      { id: "tag-3", hashtag: "#resistancebands", platform: "instagram", volume: 1000, velocity: 5, niche: "fitness" },
      withBands,
    );
    expect(score).toBeGreaterThan(40);
  });

  it("caps at 100", () => {
    const score = scoreHashtagRelevance(
      { id: "tag-4", hashtag: "#fitness", platform: "instagram", volume: 1000000, velocity: 100, niche: "fitness" },
      input(),
    );
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("scoreAudioRelevance", () => {
  it("scores high usage + velocity audio high", () => {
    const score = scoreAudioRelevance(
      { id: "audio-1", audioId: "a1", platform: "instagram", title: "Workout", artist: "DJ", usageCount: 5000, velocity: 20 },
      input(),
    );
    expect(score).toBeGreaterThan(50);
  });

  it("boosts when product keyword in title", () => {
    const withProductAudio = input({
      trendingAudio: [{ id: "audio-2", audioId: "a1", platform: "instagram", title: "Resistance Bands Mix", artist: "DJ", usageCount: 100, velocity: 5 }],
    });
    const score = scoreAudioRelevance(
      { id: "audio-3", audioId: "a1", platform: "instagram", title: "Resistance Bands Mix", artist: "DJ", usageCount: 100, velocity: 5 },
      withProductAudio,
    );
    expect(score).toBeGreaterThan(40);
  });
});

describe("scoreViralPostRemix", () => {
  it("scores high engagement + views + affiliate links high", () => {
    const post: ViralPost = {
      id: "test-1",
      platform: "instagram",
      platformPostId: "p1",
      authorHandle: "test",
      caption: "test",
      hashtags: ["#fitness"],
      audioId: "audio1",
      views: 100000,
      likes: 5000,
      comments: 200,
      shares: 100,
      engagementRate: 0.053,
      affiliateLinks: ["go.affiliateautopilot.app/abc"],
      niche: "fitness",
    };
    const score = scoreViralPostRemix(post, input());
    expect(score).toBeGreaterThan(60);
  });

  it("scores lower without affiliate links", () => {
    const post: ViralPost = {
      id: "test-2",
      platform: "tiktok",
      platformPostId: "p2",
      authorHandle: "test",
      caption: "test",
      hashtags: ["#yoga"],
      audioId: null,
      views: 50000,
      likes: 2000,
      comments: 50,
      shares: 20,
      engagementRate: 0.041,
      affiliateLinks: [],
      niche: "fitness",
    };
    const score = scoreViralPostRemix(post, input());
    expect(score).toBeLessThan(60);
  });
});

describe("generateRemixSuggestions", () => {
  it("generates suggestions for high-scoring posts", () => {
    const suggestions = generateRemixSuggestions(input());
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it("each suggestion has required fields", () => {
    const suggestions = generateRemixSuggestions(input());
    for (const s of suggestions) {
      expect(s.suggestedFormat).toMatch(/^(remix|reaction|tutorial|showcase)$/);
      expect(s.hookIdea).toBeTruthy();
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("picks product when keywords match", () => {
    const suggestions = generateRemixSuggestions(input());
    const withProduct = suggestions.filter((s) => s.productId);
    expect(withProduct.length).toBeGreaterThan(0);
  });

  it("determines format from caption keywords", () => {
    const withTutorial = input({
      viralPosts: [{
        id: "viral-3",
        platform: "instagram",
        platformPostId: "p3",
        authorHandle: "test",
        caption: "How to use resistance bands tutorial",
        hashtags: ["#fitness", "#workout"], // match trending hashtags for overlap
        audioId: null,
        views: 100000, // higher views for score
        likes: 5000,
        comments: 200,
        shares: 100,
        engagementRate: 0.05, // higher engagement
        affiliateLinks: [],
        niche: "fitness",
      }],
    });
    const suggestions = generateRemixSuggestions(withTutorial);
    const tutorial = suggestions.find((s) => s.suggestedFormat === "tutorial");
    expect(tutorial).toBeTruthy();
  });
});

describe("getTopHashtagsForNiche", () => {
  it("filters by niche", () => {
    const tags = getTopHashtagsForNiche(input().trendingHashtags, "fitness", 5);
    expect(tags.every((t) => t.niche === "fitness")).toBe(true);
  });

  it("sorts by velocity desc", () => {
    const tags = getTopHashtagsForNiche(input().trendingHashtags, null, 10);
    for (let i = 1; i < tags.length; i++) {
      expect((tags[i - 1].velocity ?? 0) >= (tags[i].velocity ?? 0)).toBe(true);
    }
  });
});

describe("getTopAudioForPlatform", () => {
  it("filters by platform", () => {
    const audio = getTopAudioForPlatform(input().trendingAudio, "instagram", 5);
    expect(audio.every((a) => a.platform === "instagram")).toBe(true);
  });

  it("sorts by velocity desc", () => {
    const audio = getTopAudioForPlatform(input().trendingAudio, "instagram", 5);
    for (let i = 1; i < audio.length; i++) {
      expect((audio[i - 1].velocity ?? 0) >= (audio[i].velocity ?? 0)).toBe(true);
    }
  });
});