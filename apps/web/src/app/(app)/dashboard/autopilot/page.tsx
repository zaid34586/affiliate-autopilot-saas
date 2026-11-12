import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { AutopilotClient } from "./autopilot-client";

export const metadata: Metadata = { title: "Autopilot" };

export default function AutopilotPage() {
  return (
    <ModulePage
      href="/dashboard/autopilot"
      extra={<AutopilotClient />}
    />
  );
}