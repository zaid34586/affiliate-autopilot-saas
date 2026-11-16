"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/auth";
import { users } from "@aa/db";
import { db } from "@/lib/db";
import { normalizeEmail, validateSignup } from "@/lib/validators";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { attributeSignup } from "@/lib/referrals/referrals";
import { isValidReferralCode } from "@/lib/referrals/referrals-core";
import { trackProductEvent } from "@/lib/analytics/product-analytics";
import { activatePendingMemberships } from "@/lib/teams/invites";
import { createFixedWindowLimiter } from "@/lib/rate-limit-core";
import {
  buildVerificationEmail,
  emailVerificationRequiredFromEnv,
  signEmailVerificationToken,
} from "@/lib/email-verification";
import { sendEmail } from "@/lib/email/email";

export type AuthFormState =
  | {
      errors?: { email?: string[]; password?: string[]; name?: string[] };
      message?: string;
      notice?: string;
    }
  | undefined;

// ───────────────────────── RATE LIMITING (Phase 4) ─────────────────────────
// Best-effort, per-instance (see rate-limit-core.ts note).

const signupIpLimiter = createFixedWindowLimiter({ limit: 5, windowMs: 60_000 });
const loginIpLimiter = createFixedWindowLimiter({ limit: 10, windowMs: 60_000 });
const loginEmailLimiter = createFixedWindowLimiter({ limit: 5, windowMs: 60_000 });

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  try {
    const token = await signEmailVerificationToken(userId);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://affiliateautopilot.app").replace(
      /\/$/,
      "",
    );
    const { subject, html, text } = buildVerificationEmail(appUrl, token);
    await sendEmail({ to: email, subject, html, text });
  } catch (err) {
    console.error("Verification email error:", err);
  }
}

/** SIGNUP — create the user + password hash, then set the session. */
export async function signup(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const referralCode = String(formData.get("ref") ?? "").trim().toUpperCase();

  const ip = await clientIp();
  const ipHit = signupIpLimiter(`signup:${ip}`);
  if (!ipHit.allowed) {
    return { message: `Too many signup attempts — try again in ${ipHit.retryAfterSeconds}s.` };
  }

  const errors = validateSignup({ name, email, password });
  if (Object.keys(errors).length > 0) return { errors };

  const verifyRequired = emailVerificationRequiredFromEnv();

  const [existing] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      authProvider: users.authProvider,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  let needsVerification = false;

  if (existing) {
    if (existing.passwordHash) {
      // Password exists. If verification is still pending, resend the link
      // instead of deadlocking (login would reject them as unverified).
      if (verifyRequired && !existing.emailVerified) {
        await sendVerificationEmail(existing.id, email);
        return { notice: `We sent a new verification link to ${email} — check your inbox.` };
      }
      return { message: "An account with this email already exists — sign in instead." };
    }

    if (existing.authProvider === "invite") {
      // Phase 4 invite fix: invite-created rows are passwordless, and signup
      // used to reject them ("account exists") while login demanded a
      // password — invited users could never get in. Adopt the row and set
      // the password here.
      const passwordHash = await bcrypt.hash(password, 10);
      const nextVerified = existing.emailVerified || !verifyRequired;
      await db
        .update(users)
        .set({
          name,
          passwordHash,
          authProvider: "credentials",
          emailVerified: nextVerified,
          ...(nextVerified && !existing.emailVerified ? { emailVerifiedAt: new Date() } : {}),
        })
        .where(eq(users.id, existing.id));
      userId = existing.id;
      needsVerification = verifyRequired && !nextVerified;
    } else {
      // OAuth-only account (Google) — they must sign in with Google.
      return { message: "An account with this email already exists — sign in instead." };
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        authProvider: "credentials",
        emailVerified: !verifyRequired,
        emailVerifiedAt: verifyRequired ? null : new Date(),
      })
      .returning({ id: users.id });
    if (!newUser) return { message: "Account creation failed — please try again." };
    userId = newUser.id;
    needsVerification = verifyRequired;
  }

  // Phase 7: referral attribution + signup funnel event + invite acceptance (best-effort)
  try {
    // Activate invites FIRST so invited-only users land in the team
    // workspace instead of a fresh personal one.
    const activated = await activatePendingMemberships(userId);
    if (activated > 0) {
      console.log(`[team] Activated ${activated} pending membership(s) for user ${userId}`);
    }

    const workspace = await getOrCreateWorkspace(userId);

    await trackProductEvent({
      workspaceId: workspace.id,
      userId,
      event: "signup",
      properties: { referral: Boolean(referralCode) },
    });

    if (referralCode && isValidReferralCode(referralCode)) {
      await attributeSignup(referralCode, userId, workspace.id);
    }
  } catch (err) {
    console.error("Post-signup tracking error:", err);
  }

  // Phase 4: when verification is enforced, stop here — the signed link
  // arrives by email and the user logs in after clicking it.
  if (needsVerification) {
    await sendVerificationEmail(userId, email);
    return {
      notice: `Almost done — we sent a verification link to ${email}. Click it, then log in.`,
    };
  }

  // session set (the JWT callback upserts the user + workspace into the DB)
  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Account created, but sign-in failed — please try again." };
    }
    throw error; // redirect yahi hota hai
  }
  return undefined;
}

/** LOGIN — verify credentials and create the session. */
export async function login(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { message: "Enter both your email and password." };
  }

  const ip = await clientIp();
  const ipHit = loginIpLimiter(`login:${ip}`);
  if (!ipHit.allowed) {
    return { message: `Too many login attempts — try again in ${ipHit.retryAfterSeconds}s.` };
  }
  const emailHit = loginEmailLimiter(`login:${email}`);
  if (!emailHit.allowed) {
    return {
      message: `Too many login attempts for this account — try again in ${emailHit.retryAfterSeconds}s.`,
    };
  }

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Only after a failed attempt (so existence isn't leaked up front):
      // tell unverified users why they can't get in instead of a generic
      // "wrong password" dead end.
      if (emailVerificationRequiredFromEnv()) {
        const [u] = await db
          .select({ emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (u && !u.emailVerified) {
          return {
            notice: `Your email isn't verified yet — check ${email} for the verification link.`,
          };
        }
      }
      return { message: "Email or password is incorrect." };
    }
    throw error;
  }
  return undefined;
}

/** LOGOUT */
export async function logout() {
  await nextAuthSignOut({ redirectTo: "/" });
}

/** Save the profile from the onboarding wizard */
export async function saveOnboardingProfile(
  _state: { message?: string } | undefined,
  formData: FormData,
): Promise<{ message?: string }> {
  const niche = String(formData.get("niche") ?? "").trim();
  const tone = String(formData.get("tone") ?? "friendly").trim();
  const handle = String(formData.get("handle") ?? "").trim().replace(/^@/, "");

  if (!niche || !handle) {
    return { message: "Both your niche and handle are required." };
  }

  const session = await (await import("@/auth")).auth();
  if (!session?.user?.id) redirect("/login");

  const { setupWorkspaceIdentity, getOrCreateWorkspace } = await import(
    "@/lib/workspace"
  );
  const workspace = await getOrCreateWorkspace(session.user.id);
  await setupWorkspaceIdentity(workspace.id, { niche, tone, handle });

  redirect("/dashboard");
}

export async function completeOnboardingSkip() {
  const session = await (await import("@/auth")).auth();
  if (!session?.user?.id) redirect("/login");
  redirect("/dashboard");
}
