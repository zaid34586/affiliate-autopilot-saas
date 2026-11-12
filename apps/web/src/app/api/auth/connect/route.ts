import { auth } from "@/auth";
import { NextResponse } from "next/server";

const OAUTH_CONFIG: Record<string, { authUrl: string; scope: string }> = {
  instagram: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
  },
  facebook: {
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    scope: "pages_show_list,pages_read_engagement,pages_manage_posts",
  },
  youtube: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile",
  },
  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    scope: "video.publish,user.info.basic,video.list",
  },
  x: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    scope: "tweet.read tweet.write users.read offline.access",
  },
  amazon: {
    authUrl: "https://www.amazon.com/ap/oa",
    scope: "profile portable:products:read portable:orders:read",
  },
  clickbank: {
    authUrl: "https://api.clickbank.com/oauth2/authorize",
    scope: "read_products read_sales",
  },
  digistore: {
    authUrl: "https://www.digistore24.com/oauth/authorize",
    scope: "read_products read_sales",
  },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = body.provider;

  const config = OAUTH_CONFIG[provider];
  if (!config) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`] || process.env[`${provider.toUpperCase()}_APP_ID`];
  if (!clientId) {
    return NextResponse.json({ error: `${provider} client ID not configured` }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/${provider}`;
  const state = Buffer.from(JSON.stringify({ workspaceId: session.user.workspaceId, provider })).toString("base64");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scope,
    response_type: "code",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `${config.authUrl}?${params.toString()}`;

  return NextResponse.json({ url: authUrl });
}