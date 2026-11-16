import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { users } from "@aa/db";
import { db } from "@/lib/db";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { emailVerificationRequiredFromEnv } from "@/lib/email-verification";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials: Partial<Record<"email" | "password", unknown>> | undefined) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user?.passwordHash) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      // Phase 4: suspended accounts + unverified emails cannot log in.
      if (user.status !== "active") return null;
      if (emailVerificationRequiredFromEnv() && !user.emailVerified) return null;

      // Accept pending team invites BEFORE workspace resolution — otherwise
      // invited-only users get a fresh personal workspace instead of the
      // team one (getOrCreateWorkspace falls back to active memberships).
      try {
        const { activatePendingMemberships } = await import("@/lib/teams/invites");
        await activatePendingMemberships(user.id);
      } catch (err) {
        console.error("Invite activation error:", err);
      }

      // Get workspace for this user
      const workspace = await getOrCreateWorkspace(user.id);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl,
        workspaceId: workspace.id,
      };
    },
  }),
];

// Google OAuth — sirf tab jab credentials set hon (Phase 0 me baad me aayega)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 }, // 30 din
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    /**
     * On sign-in, upsert the user into the DB and auto-create
     * the workspace (for both OAuth and credentials flows).
     */
    async jwt({ token, user, account }) {
      // Session revocation (Phase 4): on every session read, a suspended
      // account or a bumped token_version (admin "revoke sessions") makes
      // the callback return null → @auth/core clears the session cookies.
      if (!user && typeof token.uid === "string") {
        const uid = token.uid;
        const [row] = await db
          .select({ status: users.status, tokenVersion: users.tokenVersion })
          .from(users)
          .where(eq(users.id, uid))
          .limit(1);
        const expected = typeof token.tv === "number" ? token.tv : 1;
        if (!row || row.status !== "active" || row.tokenVersion !== expected) {
          return null;
        }
      }

      if (user?.email) {
        const email = user.email.toLowerCase();
        const isOAuth = Boolean(account && account.provider !== "credentials");

        const [dbUser] = await db
          .insert(users)
          .values({
            email,
            name: user.name ?? null,
            avatarUrl: user.image ?? null,
            authProvider: account?.provider ?? "credentials",
            passwordHash: undefined, // already set during credentials signup
            // OAuth providers (Google) vouch for email ownership.
            ...(isOAuth ? { emailVerified: true, emailVerifiedAt: new Date() } : {}),
          })
          .onConflictDoUpdate({
            target: users.email,
            set: {
              name: user.name ?? undefined,
              avatarUrl: user.image ?? undefined,
              // Linking via OAuth proves ownership → mark verified too.
              ...(isOAuth
                ? { emailVerified: true, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` }
                : {}),
            },
          })
          .returning({
            id: users.id,
            status: users.status,
            tokenVersion: users.tokenVersion,
          });

        if (dbUser) {
          // Suspended accounts cannot establish a session via OAuth either.
          if (dbUser.status !== "active") return null;

          token.uid = dbUser.id;
          token.tv = dbUser.tokenVersion;

          // Phase 7/4: accept pending team invites on sign-in — BEFORE
          // workspace resolution so invited-only users land in the team
          // workspace instead of a fresh personal one.
          try {
            const { activatePendingMemberships } = await import("@/lib/teams/invites");
            await activatePendingMemberships(dbUser.id);
          } catch (err) {
            console.error("Invite activation error:", err);
          }

          // workspace guaranteed ho (naye + purane dono)
          const workspace = await getOrCreateWorkspace(dbUser.id);
          token.workspaceId = workspace.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        session.user.workspaceId = token.workspaceId as string;
      }
      return session;
    },
  },
});
