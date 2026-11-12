import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <ModulePage href="/dashboard/settings" />;
}
