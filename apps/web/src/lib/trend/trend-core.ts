/**
 * Phase 5 Module E — Trend Miner (pure core).
 *
 * Analyzes trending data and generates remix suggestions.
 * No DB access — pure logic for unit testing.
 */

export type TrendingHashtag = {
  id: string; // UUID from database
  hashtag: string;
  platform: string;
  volume: number;
  velocity: number | null;
  niche: string | null;
};

export type TrendingAudio = {
  id: string; // UUID from database
  audioId: string; // platform's audio ID
  platform: string;
  title: string | null;
  artist: string | null;
  usageCount: number;
  velocity: number | null;
};

export type ViralPost = {
  id: string; // UUID from database
  platform: string;
  platformPostId: string;
  authorHandle: string;
  caption: string | null;
  hashtags: string[];
  audioId: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number | null;
  affiliateLinks: string[];
  niche: string | null;
};

export type ProductContext = {
  id: string;
  title: string;
  niche: string | null;
  commissionType: string | null;
  commissionValue: string | null;
};

export type RemixSuggestion = {
  viralPostId: string | null;
  trendingHashtagId: string | null;
  trendingAudioId: string | null;
  productId: string | null;
  suggestedFormat: "remix" | "reaction" | "tutorial" | "showcase";
  hookIdea: string;
  scriptOutline: string | null;
  confidence: number; // 0-100
};

export type TrendAnalysisInput = {
  workspaceNiche: string | null;
  products: ProductContext[];
  trendingHashtags: TrendingHashtag[];
  trendingAudio: TrendingAudio[];
  viralPosts: ViralPost[];
};

/**
 * Score a trending hashtag for relevance to workspace niche + products.
 */
export function scoreHashtagRelevance(
  hashtag: TrendingHashtag,
  input: TrendAnalysisInput,
): number {
  let score = 0;

  // Volume weight (0-30)
  score += Math.min(30, Math.floor(hashtag.volume / 1000));

  // Velocity weight (0-25)
  if (hashtag.velocity != null && hashtag.velocity > 0) {
    score += Math.min(25, Math.floor(hashtag.velocity / 5));
  }

  // Niche match (0-25)
  if (hashtag.niche && input.workspaceNiche) {
    if (hashtag.niche.toLowerCase() === input.workspaceNiche.toLowerCase()) {
      score += 25;
    } else if (
      hashtag.niche.toLowerCase().includes(input.workspaceNiche.toLowerCase()) ||
      input.workspaceNiche.toLowerCase().includes(hashtag.niche.toLowerCase())
    ) {
      score += 15;
    }
  }

  // Product keyword match in hashtag (0-20)
  for (const product of input.products) {
    const productWords = product.title.toLowerCase().split(/\s+/);
    for (const word of productWords) {
      if (word.length > 3 && hashtag.hashtag.toLowerCase().includes(word)) {
        score += 20;
        break;
      }
    }
  }

  return Math.min(100, score);
}

/**
 * Score trending audio relevance.
 */
export function scoreAudioRelevance(
  audio: TrendingAudio,
  input: TrendAnalysisInput,
): number {
  let score = 0;

  // Usage count weight (0-30)
  score += Math.min(30, Math.floor(audio.usageCount / 100));

  // Velocity weight (0-25)
  if (audio.velocity != null && audio.velocity > 0) {
    score += Math.min(25, Math.floor(audio.velocity / 5));
  }

  // Title/artist keyword match with products (0-25)
  const searchText = `${audio.title ?? ""} ${audio.artist ?? ""}`.toLowerCase();
  for (const product of input.products) {
    const productWords = product.title.toLowerCase().split(/\s+/);
    for (const word of productWords) {
      if (word.length > 3 && searchText.includes(word)) {
        score += 25;
        break;
      }
    }
  }

  // Platform match (0-20) - prefer platforms workspace uses
  // (simplified: just give base score)
  score += 20;

  return Math.min(100, score);
}

/**
 * Score viral post for remix potential.
 */
export function scoreViralPostRemix(
  post: ViralPost,
  input: TrendAnalysisInput,
): number {
  let score = 0;

  // Engagement rate weight (0-30)
  if (post.engagementRate != null && post.engagementRate > 0) {
    score += Math.min(30, Math.floor(post.engagementRate * 1000));
  }

  // Views weight (0-25)
  score += Math.min(25, Math.floor(post.views / 10000));

  // Has affiliate links already (0-20) - shows monetization potential
  if (post.affiliateLinks.length > 0) {
    score += 20;
  }

  // Hashtag overlap with trending (0-15)
  const trendingTags = new Set(input.trendingHashtags.map((h) => h.hashtag.toLowerCase()));
  const postTags = new Set(post.hashtags.map((h) => h.toLowerCase()));
  const overlap = [...trendingTags].filter((t) => postTags.has(t)).length;
  score += Math.min(15, overlap * 3);

  // Audio match with trending (0-10)
  if (post.audioId && input.trendingAudio.some((a) => a.audioId === post.audioId)) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Generate remix suggestions from top viral posts + trending elements.
 */
export function generateRemixSuggestions(
  input: TrendAnalysisInput,
): RemixSuggestion[] {
  const suggestions: RemixSuggestion[] = [];

  // Score and sort viral posts
  const scoredPosts = input.viralPosts
    .map((post) => ({
      post,
      score: scoreViralPostRemix(post, input),
    }))
    .filter((p) => p.score > 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const { post, score } of scoredPosts) {
    // Find best matching product
    let bestProduct: ProductContext | null = null;
    let bestProductScore = 0;

    for (const product of input.products) {
      const productWords = product.title.toLowerCase().split(/\s+/);
      const postText = `${post.caption ?? ""} ${post.hashtags.join(" ")}`.toLowerCase();
      let matchScore = 0;
      for (const word of productWords) {
        if (word.length > 3 && postText.includes(word)) {
          matchScore += 10;
        }
      }
      if (matchScore > bestProductScore) {
        bestProductScore = matchScore;
        bestProduct = product;
      }
    }

    // Determine format based on post type
    let format: RemixSuggestion["suggestedFormat"] = "remix";
    if (post.caption?.toLowerCase().includes("how to") || post.caption?.toLowerCase().includes("tutorial")) {
      format = "tutorial";
    } else if (post.caption?.toLowerCase().includes("reaction") || post.caption?.toLowerCase().includes("react")) {
      format = "reaction";
    } else if (post.affiliateLinks.length > 0) {
      format = "showcase";
    }

    // Find matching trending hashtag
    let hashtagId: string | null = null;
    for (const tag of input.trendingHashtags) {
      if (post.hashtags.some((h) => h.toLowerCase() === tag.hashtag.toLowerCase())) {
        hashtagId = tag.id; // use database UUID
        break;
      }
    }

    // Find matching trending audio
    let audioId: string | null = null;
    if (post.audioId) {
      for (const audio of input.trendingAudio) {
        if (audio.id === post.audioId) { // match by database UUID
          audioId = audio.id;
          break;
        }
      }
    }

    const hookIdea = generateHookIdea(post, bestProduct, format);
    const scriptOutline = generateScriptOutline(post, bestProduct, format);

    suggestions.push({
      viralPostId: post.id,
      trendingHashtagId: hashtagId,
      trendingAudioId: audioId,
      productId: bestProduct?.id ?? null,
      suggestedFormat: format,
      hookIdea,
      scriptOutline,
      confidence: score,
    });
  }

  return suggestions;
}

function generateHookIdea(post: ViralPost, product: ProductContext | null, format: string): string {
  const base = product ? `Show how ${product.title} fits the viral ${format}` : `Remix this viral ${format} for your niche`;

  const hooks = [
    `Everyone's doing the ${post.hashtags[0] ?? "trend"} — here's my ${format} with ${product?.title ?? "our product"}`,
    `POV: You found the viral ${post.hashtags[0] ?? "sound"} and made it about ${product?.title ?? "your niche"}`,
    `Steal this ${format} formula: ${post.caption?.slice(0, 50) ?? "viral hook"} + ${product?.title ?? "product"}`,
    `The ${post.hashtags[0] ?? "trend"} everyone's copying — but for ${product?.niche ?? "your audience"}`,
  ];

  return hooks[Math.floor(Math.random() * hooks.length)];
}

function generateScriptOutline(post: ViralPost, product: ProductContext | null, format: string): string {
  const scenes = [
    "0-3s: Hook — show viral clip or trend reference",
    "3-8s: Problem/desire — \"Wish you could [benefit]?\"",
    `8-15s: Solution — demo ${product?.title ?? "product"} in action`,
    "15-22s: Proof — results/testimonial/social proof",
    `22-30s: CTA — "Link in bio" + ${product ? "commission details" : "follow for more"}`,
  ];

  return scenes.join("\n");
}

/**
 * Get top trending hashtags for a niche.
 */
export function getTopHashtagsForNiche(
  hashtags: TrendingHashtag[],
  niche: string | null,
  limit: number = 10,
): TrendingHashtag[] {
  return hashtags
    .filter((h) => !niche || !h.niche || h.niche.toLowerCase() === niche.toLowerCase())
    .sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0))
    .slice(0, limit);
}

/**
 * Get top trending audio for a platform.
 */
export function getTopAudioForPlatform(
  audio: TrendingAudio[],
  platform: string,
  limit: number = 10,
): TrendingAudio[] {
  return audio
    .filter((a) => a.platform === platform)
    .sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0))
    .slice(0, limit);
}