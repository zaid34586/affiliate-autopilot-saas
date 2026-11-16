import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const { verify } = await searchParams;
  const notice =
    verify === "success"
      ? "Email verified — you can log in now."
      : verify === "failed"
        ? "That verification link is invalid or expired — sign up again to get a fresh one."
        : undefined;

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="grid-dots flex min-h-screen items-center justify-center px-4 py-12">
      <AuthForm mode="login" googleEnabled={googleEnabled} notice={notice} />
    </main>
  );
}
