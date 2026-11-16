import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { connections } from "@aa/db";
import { isValidProvider } from "@/lib/connections/oauth-config";
import { verifyOAuthState, getStateCookie, clearStateCookie } from "@/lib/connections/oauth-state";
import { encryptToken } from "@/lib/crypto/secrets";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/** Constant-time string compare (equal length only). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function exchangeCodeForTokens(
  provider: string,
  code: string,
  redirectUri: string,
  pkceVerifier?: string
): Promise<TokenResponse> {
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`] || process.env[`${provider.toUpperCase()}_APP_ID`];
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] || process.env[`${provider.toUpperCase()}_APP_SECRET`];

  let tokenUrl: string;
  let params: URLSearchParams;

  if (provider === "instagram" || provider === "facebook") {
    tokenUrl = "https://graph.facebook.com/v19.0/oauth/access_token";
    params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
  } else if (provider === "youtube") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
  } else if (provider === "tiktok") {
    tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";
    params = new URLSearchParams({
      client_key: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
  } else if (provider === "x") {
    tokenUrl = "https://api.twitter.com/2/oauth2/token";
    params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
    if (pkceVerifier) {
      params.set("code_verifier", pkceVerifier);
    }
  } else if (provider === "amazon") {
    tokenUrl = "https://api.amazon.com/auth/o2/token";
    params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
  } else if (provider === "clickbank") {
    tokenUrl = "https://api.clickbank.com/oauth2/token";
    params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
  } else if (provider === "digistore") {
    tokenUrl = "https://www.digistore24.com/oauth/token";
    params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    });
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokens: TokenResponse = await res.json();

  // Instagram/Facebook: short-lived tokens expire in ~1h — exchange for a
  // long-lived one (~60 days) and store its real expiry.
  if ((provider === "instagram" || provider === "facebook") && tokens.access_token) {
    try {
      const llRes = await fetch(
        "https://graph.facebook.com/v19.0/oauth/access_token?" +
          new URLSearchParams({
            grant_type: "fb_exchange_token",
            client_id: clientId!,
            client_secret: clientSecret!,
            fb_exchange_token: tokens.access_token,
          })
      );
      if (llRes.ok) {
        const ll = (await llRes.json()) as TokenResponse;
        if (ll.access_token) {
          tokens.access_token = ll.access_token;
          if (ll.expires_in) tokens.expires_in = ll.expires_in;
          if (ll.refresh_token) tokens.refresh_token = ll.refresh_token;
        }
      } else {
        console.warn(`Long-lived token exchange failed for ${provider}: ${llRes.status}`);
      }
    } catch (e) {
      console.warn(`Long-lived token exchange error for ${provider}:`, e);
    }
  }

  return tokens;
}

async function fetchAccountInfo(provider: string, accessToken: string): Promise<{ id: string; name: string; avatar?: string }> {
  let url: string;
  const headers: HeadersInit = { Authorization: `Bearer ${accessToken}` };

  if (provider === "instagram") {
    // Documented flow: user token -> /me/accounts (pages) -> page ->
    // instagram_business_account. (`username` is NOT a Graph User field, so
    // /me?fields=...username... is invalid — see Phase 1.6.)
    const pagesRes = await fetch(
      "https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}",
      { headers }
    );
    if (pagesRes.ok) {
      const pagesData = (await pagesRes.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
        }>;
      };
      const withIg = pagesData.data?.find((p) => p.instagram_business_account);
      if (withIg?.instagram_business_account) {
        const ig = withIg.instagram_business_account;
        return { id: ig.id, name: ig.username ?? withIg.name ?? "Instagram", avatar: ig.profile_picture_url };
      }
      // No IG business account linked — fall back to the page identity.
      const page = pagesData.data?.[0];
      if (page) return { id: page.id, name: page.name ?? "Facebook Page" };
    }
    throw new Error("No Instagram Business Account found on any managed page");
  } else if (provider === "facebook") {
    url = "https://graph.facebook.com/v19.0/me?fields=id,name,picture";
  } else if (provider === "youtube") {
    url = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
  } else if (provider === "tiktok") {
    url = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url";
  } else if (provider === "x") {
    url = "https://api.twitter.com/2/users/me";
  } else if (provider === "amazon") {
    url = "https://api.amazon.com/user/profile";
  } else if (provider === "clickbank") {
    url = "https://api.clickbank.com/rest/1.3/account";
  } else if (provider === "digistore") {
    url = "https://www.digistore24.com/api/v1/account";
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch account info: ${res.statusText}`);
  const data = await res.json();

  // Normalize response
  if (provider === "facebook") return { id: data.id, name: data.name, avatar: data.picture?.data?.url };
  if (provider === "youtube") return { id: data.items?.[0]?.id, name: data.items?.[0]?.snippet?.title, avatar: data.items?.[0]?.snippet?.thumbnails?.default?.url };
  if (provider === "tiktok") return { id: data.data?.user?.open_id, name: data.data?.user?.display_name, avatar: data.data?.user?.avatar_url };
  if (provider === "x") return { id: data.data?.id, name: data.data?.username, avatar: data.data?.profile_image_url };
  if (provider === "amazon") return { id: data.user_id, name: data.name };
  if (provider === "clickbank") return { id: data.account_id, name: data.account_nickname };
  if (provider === "digistore") return { id: data.vendor_id, name: data.vendor_name };

  return { id: "", name: "Unknown" };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.pathname.split("/").filter(Boolean).pop()!;
  const searchParams = url.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // All exits clear the one-shot state cookie.
  const fail = (reason: string) => {
    const response = NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/connections?error=${reason}`
    );
    clearStateCookie(response.headers);
    return response;
  };

  if (error) return fail(String(error).slice(0, 64));

  if (!code || !state) return fail("missing_params");

  // Verify provider is valid (allow-list = keys of OAUTH_CONFIG)
  if (!isValidProvider(provider)) return fail("invalid_provider");

  // Verify state signature + expiry (HMAC-SHA256 via jose, exp <= 10 min)
  const verifiedState = await verifyOAuthState(state);
  if (!verifiedState) return fail("invalid_state");

  // Verify state matches provider
  if (verifiedState.provider !== provider) return fail("provider_mismatch");

  // Verify logged-in session owns the workspace in the state (CSRF/hijack guard)
  const session = await auth();
  if (!session?.user?.workspaceId || session.user.workspaceId !== verifiedState.workspaceId) {
    return fail("unauthorized");
  }

  // Verify nonce matches the httpOnly cookie set by /api/auth/connect
  const cookieNonce = getStateCookie(req);
  if (!cookieNonce || !timingSafeEqualStr(cookieNonce, verifiedState.nonce)) {
    return fail("invalid_state");
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/${provider}`;
    const tokens = await exchangeCodeForTokens(provider, code, redirectUri, verifiedState.pkceVerifier);
    const account = await fetchAccountInfo(provider, tokens.access_token);

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null;

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await db.insert(connections).values({
      workspaceId: session.user.workspaceId,
      provider: provider,
      accountId: account.id,
      accountName: account.name,
      accountAvatar: account.avatar,
      accessTokenEnc: encryptedAccessToken,
      refreshTokenEnc: encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope?.split(" ") || [],
      status: "active",
    }).onConflictDoUpdate({
      target: [connections.workspaceId, connections.provider],
      set: {
        accountId: account.id,
        accountName: account.name,
        accountAvatar: account.avatar,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope?.split(" ") || [],
        status: "active",
      },
    });

    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?connected=${provider}`);
    clearStateCookie(response.headers);
    return response;
  } catch (e) {
    console.error(`OAuth callback error for ${provider}:`, e);
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=callback_failed`);
    clearStateCookie(response.headers);
    return response;
  }
}