import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="grid-dots flex min-h-screen items-center justify-center px-4 py-12">
      <AuthForm mode="signup" googleEnabled={googleEnabled} />
    </main>
  );
}
