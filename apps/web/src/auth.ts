import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "@aa/db";
import { db } from "@/lib/db";
import { getOrCreateWorkspace } from "@/lib/workspace";

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
      if (user?.email) {
        const email = user.email.toLowerCase();

        const [dbUser] = await db
          .insert(users)
          .values({
            email,
            name: user.name ?? null,
            avatarUrl: user.image ?? null,
            authProvider: account?.provider ?? "credentials",
            passwordHash: undefined, // already set during credentials signup
          })
          .onConflictDoUpdate({
            target: users.email,
            set: {
              name: user.name ?? undefined,
              avatarUrl: user.image ?? undefined,
            },
          })
          .returning({ id: users.id });

        if (dbUser) {
          token.uid = dbUser.id;
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
