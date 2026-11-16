import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { OAUTH_CONFIG, isValidProvider } from "@/lib/connections/oauth-config";
import { createOAuthState, setStateCookie, generatePkceVerifier } from "@/lib/connections/oauth-state";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = body.provider;

  if (!provider || !isValidProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const config = OAUTH_CONFIG[provider];
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`] || process.env[`${provider.toUpperCase()}_APP_ID`];
  if (!clientId) {
    return NextResponse.json({ error: `${provider} client ID not configured` }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/${provider}`;

  // Generate PKCE verifier/challenge if required
  let pkceVerifier: string | undefined;
  let codeChallenge: string | undefined;
  if (config.pkceRequired) {
    const pkce = await generatePkceVerifier();
    pkceVerifier = pkce.verifier;
    codeChallenge = pkce.challenge;
  }

  // Create signed state with HMAC
  const { state, nonce } = await createOAuthState(session.user.workspaceId, provider, pkceVerifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scope,
    response_type: "code",
    state,
  });

  // Only add offline access for providers that support it
  if (config.supportsOfflineAccess) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  // Add PKCE challenge if required
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  const authUrl = `${config.authUrl}?${params.toString()}`;

  const response = NextResponse.json({ url: authUrl });
  setStateCookie(response.headers, nonce);
  return response;
}