/**
 * Phase 7 — Feature Flags Core (pure logic).
 * 
 * Feature flag system with:
 * - Boolean flags (on/off)
 * - Percentage rollouts (0-100%)
 * - Targeted rollouts (specific users/workspaces/roles)
 * - Multivariate tests (control/variant_a/variant_b)
 * - Deterministic evaluation (consistent assignment)
 */

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  targeting: {
    userIds?: string[];
    workspaceIds?: string[];
    roles?: string[]; // "owner", "admin", "editor", "viewer"
  };
  variants: Array<{
    key: string;
    weight: number; // percentage weight
    payload?: Record<string, unknown>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagEvaluation {
  flagKey: string;
  enabled: boolean;
  variant: string; // variant key
  payload?: Record<string, unknown>;
  matched: boolean; // false = fallback to control
}

export interface FeatureFlagContext {
  workspaceId?: string;
  userId?: string;
  userRole?: string;
  customAttributes?: Record<string, unknown>;
}

/**
 * Deterministic hash for consistent assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get deterministic bucket (0-99) for consistent assignment
 */
function getBucket(identifier: string, salt: string): number {
  return hashString(`${identifier}:${salt}`) % 100;
}

/**
 * Evaluate a feature flag for a given context
 */
export function evaluateFeatureFlag(
  flag: FeatureFlag,
  context: FeatureFlagContext,
): FeatureFlagEvaluation {
  // Flag disabled globally
  if (!flag.enabled) {
    return {
      flagKey: flag.key,
      enabled: false,
      variant: "control",
      payload: undefined,
      matched: false,
    };
  }

  // Check explicit targeting
  if (context.userId && flag.targeting.userIds?.includes(context.userId)) {
    const variant = selectVariant(flag.variants, context.userId + ":" + flag.key);
    return {
      flagKey: flag.key,
      enabled: true,
      variant: variant.key,
      payload: variant.payload,
      matched: true,
    };
  }

  if (context.workspaceId && flag.targeting.workspaceIds?.includes(context.workspaceId)) {
    const variant = selectVariant(flag.variants, context.workspaceId + ":" + flag.key);
    return {
      flagKey: flag.key,
      enabled: true,
      variant: variant.key,
      payload: variant.payload,
      matched: true,
    };
  }

  if (context.userRole && flag.targeting.roles?.includes(context.userRole)) {
    const variant = selectVariant(flag.variants, context.userRole + ":" + flag.key);
    return {
      flagKey: flag.key,
      enabled: true,
      variant: variant.key,
      payload: variant.payload,
      matched: true,
    };
  }

  // Percentage rollout
  const identifier = context.workspaceId || context.userId || "anonymous";
  const bucket = getBucket(identifier, flag.key);
  
  if (bucket >= flag.rolloutPercentage) {
    return {
      flagKey: flag.key,
      enabled: false,
      variant: "control",
      payload: undefined,
      matched: false,
    };
  }

  // Select variant based on weights
  const variant = selectVariant(flag.variants, identifier + ":" + flag.key);
  
  return {
    flagKey: flag.key,
    enabled: true,
    variant: variant.key,
    payload: variant.payload,
    matched: true,
  };
}

/**
 * Select variant based on weights (deterministic)
 */
function selectVariant(
  variants: Array<{ key: string; weight: number; payload?: Record<string, unknown> }>,
  identifier: string,
): { key: string; weight: number; payload?: Record<string, unknown> } {
  if (variants.length === 0) {
    return { key: "control", weight: 100 };
  }
  
  if (variants.length === 1) {
    return variants[0];
  }

  const bucket = getBucket(identifier, "variant");
  let cumulative = 0;
  
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return variant;
    }
  }
  
  // Fallback to last variant
  return variants[variants.length - 1];
}

/**
 * Validate feature flag configuration
 */
export function validateFeatureFlag(flag: Partial<FeatureFlag>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!flag.key || !/^[a-z][a-z0-9_]*$/.test(flag.key)) {
    errors.push("Key must be lowercase alphanumeric with underscores, starting with a letter");
  }

  if (!flag.name || flag.name.trim().length === 0) {
    errors.push("Name is required");
  }

  if (flag.rolloutPercentage !== undefined && (flag.rolloutPercentage < 0 || flag.rolloutPercentage > 100)) {
    errors.push("Rollout percentage must be between 0 and 100");
  }

  if (flag.variants) {
    const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      errors.push("Variant weights must sum to 100");
    }
    const keys = new Set<string>();
    for (const v of flag.variants) {
      if (keys.has(v.key)) {
        errors.push(`Duplicate variant key: ${v.key}`);
      }
      keys.add(v.key);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Default feature flags for the application
 */
export const DEFAULT_FLAGS: Partial<FeatureFlag>[] = [
  {
    key: "new_video_editor",
    name: "New Video Editor",
    description: "Enable the new video editor UI",
    enabled: false,
    rolloutPercentage: 0,
    variants: [
      { key: "control", weight: 50 },
      { key: "variant_a", weight: 50, payload: { editorVersion: "v2" } },
    ],
  },
  {
    key: "ai_copilot_v2",
    name: "AI Copilot v2",
    description: "Enable improved AI Copilot with better reasoning",
    enabled: true,
    rolloutPercentage: 100,
    variants: [
      { key: "control", weight: 100 },
    ],
  },
  {
    key: "voice_clone_beta",
    name: "Voice Clone Beta",
    description: "Allow users to clone their voice for video narration",
    enabled: false,
    rolloutPercentage: 10,
    variants: [
      { key: "control", weight: 100 },
    ],
  },
  {
    key: "video_remix",
    name: "Video Remix",
    description: "Enable 1-click video remix for new products",
    enabled: true,
    rolloutPercentage: 100,
    variants: [
      { key: "control", weight: 100 },
    ],
  },
  {
    key: "whatsapp_bot",
    name: "WhatsApp Bot",
    description: "Enable WhatsApp Click-to-Chat bot funnel",
    enabled: true,
    rolloutPercentage: 100,
    variants: [
      { key: "control", weight: 100 },
    ],
  },
  {
    key: "character_v3",
    name: "Character v3",
    description: "Enable voice notes and full-personality DM replies",
    enabled: true,
    rolloutPercentage: 100,
    variants: [
      { key: "control", weight: 100 },
    ],
  },
];