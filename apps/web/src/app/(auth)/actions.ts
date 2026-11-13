"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/auth";
import { users } from "@aa/db";
import { db } from "@/lib/db";
import { normalizeEmail, validateSignup } from "@/lib/validators";

export type AuthFormState =
  | { errors?: { email?: string[]; password?: string[]; name?: string[] }; message?: string }
  | undefined;

/** SIGNUP — create the user + password hash, then set the session. */
export async function signup(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  const errors = validateSignup({ name, email, password });
  if (Object.keys(errors).length > 0) return { errors };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { message: "An account with this email already exists — sign in instead." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    email,
    name,
    passwordHash,
    authProvider: "credentials",
  });

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

  try {
    await nextAuthSignIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
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
