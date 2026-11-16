/**
 * OAuth Configuration - shared between connect and callback routes.
 * Single source of truth for provider auth URLs and scopes.
 */

export const OAUTH_CONFIG: Record<
  string,
  { authUrl: string; scope: string; supportsOfflineAccess: boolean; pkceRequired: boolean }
> = {
  instagram: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    supportsOfflineAccess: false,
    pkceRequired: false,
  },
  facebook: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "pages_show_list,pages_read_engagement,pages_manage_posts",
    supportsOfflineAccess: false,
    pkceRequired: false,
  },
  youtube: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile",
    supportsOfflineAccess: true,
    pkceRequired: false,
  },
  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    scope: "video.publish,user.info.basic,video.list",
    supportsOfflineAccess: false,
    pkceRequired: true,
  },
  x: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    scope: "tweet.read tweet.write users.read offline.access",
    supportsOfflineAccess: false, // refresh via `offline.access` scope, not Google's param
    pkceRequired: true,
  },
  amazon: {
    authUrl: "https://www.amazon.com/ap/oa",
    scope: "profile portable:products:read portable:orders:read",
    supportsOfflineAccess: false,
    pkceRequired: false,
  },
  clickbank: {
    authUrl: "https://api.clickbank.com/oauth2/authorize",
    scope: "read_products read_sales",
    supportsOfflineAccess: false,
    pkceRequired: false,
  },
  digistore: {
    authUrl: "https://www.digistore24.com/oauth/authorize",
    scope: "read_products read_sales",
    supportsOfflineAccess: false,
    pkceRequired: false,
  },
} as const;

export type OAuthProvider = keyof typeof OAUTH_CONFIG;

export function isValidProvider(provider: string): provider is OAuthProvider {
  return provider in OAUTH_CONFIG;
}

export function getProviderConfig(provider: OAuthProvider) {
  return OAUTH_CONFIG[provider];
}