import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Autopilot" };

export default function AutopilotPage() {
  return <ModulePage href="/dashboard/autopilot" />;
}
