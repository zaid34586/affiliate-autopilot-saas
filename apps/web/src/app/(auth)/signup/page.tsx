import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  const params = await searchParams;
  const rawRef = params.ref;
  const refCode = typeof rawRef === "string" ? rawRef.toUpperCase().slice(0, 12) : "";

  return (
    <main className="grid-dots flex min-h-screen items-center justify-center px-4 py-12">
      <AuthForm mode="signup" googleEnabled={googleEnabled} referralCode={refCode} />
    </main>
  );
}
