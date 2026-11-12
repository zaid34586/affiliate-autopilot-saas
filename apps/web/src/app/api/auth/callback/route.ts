import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { connections } from "@aa/db";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

async function exchangeCodeForTokens(
  provider: string,
  code: string,
  redirectUri: string
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
      code_verifier: "challenge", // PKCE - would need to store verifier in state
    });
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

  return res.json();
}

async function fetchAccountInfo(provider: string, accessToken: string): Promise<{ id: string; name: string; avatar?: string }> {
  let url: string;
  const headers: HeadersInit = { Authorization: `Bearer ${accessToken}` };

  if (provider === "instagram") {
    url = "https://graph.facebook.com/v19.0/me?fields=id,username,profile_picture_url";
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
  if (provider === "instagram") return { id: data.id, name: data.username, avatar: data.profile_picture_url };
  if (provider === "facebook") return { id: data.id, name: data.name, avatar: data.picture?.data?.url };
  if (provider === "youtube") return { id: data.items?.[0]?.id, name: data.items?.[0]?.snippet?.title, avatar: data.items?.[0]?.snippet?.thumbnails?.default?.url };
  if (provider === "tiktok") return { id: data.data?.user?.open_id, name: data.data?.user?.display_name, avatar: data.data?.user?.avatar_url };
  if (provider === "x") return { id: data.data?.id, name: data.data?.username, avatar: data.data?.profile_image_url };
  if (provider === "amazon") return { id: data.user_id, name: data.name };
  if (provider === "clickbank") return { id: data.account_id, name: data.account_nickname };
  if (provider === "digistore") return { id: data.vendor_id, name: data.vendor_name };

  return { id: "", name: "Unknown" };
}

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.pathname.split("/").slice(-2, -1)[0]!;
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=missing_params`);
  }

  let workspaceId: string;
  let providerFromState: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString());
    workspaceId = decoded.workspaceId;
    providerFromState = decoded.provider;
  } catch {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=invalid_state`);
  }

  if (providerFromState !== provider) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=provider_mismatch`);
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/${provider}`;
    const tokens = await exchangeCodeForTokens(provider, code, redirectUri);
    const account = await fetchAccountInfo(provider, tokens.access_token);

    // TODO: Encrypt tokens before storing (use crypto.subtle or libsodium)
    // For now storing as-is - PRODUCTION MUST ENCRYPT
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await db.insert(connections).values({
      workspaceId: workspaceId,
      provider: provider,
      accountId: account.id,
      accountName: account.name,
      accountAvatar: account.avatar,
      accessTokenEnc: tokens.access_token, // TODO: encrypt
      refreshTokenEnc: tokens.refresh_token, // TODO: encrypt
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope?.split(" ") || [],
      status: "active",
    }).onConflictDoUpdate({
      target: [connections.workspaceId, connections.provider],
      set: {
        accountId: account.id,
        accountName: account.name,
        accountAvatar: account.avatar,
        accessTokenEnc: tokens.access_token,
        refreshTokenEnc: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope?.split(" ") || [],
        status: "active",
      },
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?connected=${provider}`);
  } catch (e) {
    console.error(`OAuth callback error for ${provider}:`, e);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=callback_failed`);
  }
}