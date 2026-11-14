import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { CopilotChat } from "./copilot-chat";

export const metadata: Metadata = { title: "AI Copilot" };

export default function CopilotPage() {
  return (
    <ModulePage
      href="/dashboard/copilot"
      extra={<CopilotChat />}
    />
  );
}