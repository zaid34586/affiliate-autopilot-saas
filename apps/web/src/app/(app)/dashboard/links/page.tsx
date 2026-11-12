import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Links" };

export default function LinksPage() {
  return <ModulePage href="/dashboard/links" />;
}
