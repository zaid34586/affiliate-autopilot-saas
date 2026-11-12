import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Content" };

export default function ContentPage() {
  return <ModulePage href="/dashboard/content" />;
}
