import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Setup" };

export default function OnboardingPage() {
  return (
    <main className="grid-dots flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <OnboardingWizard />
      <Link
        href="/dashboard"
        className="label mt-6 text-bone-3 hover:text-bone-2"
      >
        Skip for now →
      </Link>
    </main>
  );
}
