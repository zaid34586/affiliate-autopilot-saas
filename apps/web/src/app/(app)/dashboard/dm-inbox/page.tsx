import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { DmInboxClient } from "./dm-inbox-client";
import { DmFunnelManager } from "./dm-funnel-manager";
import { DmAttribution } from "./dm-attribution";

export const metadata: Metadata = { title: "DM Inbox" };

export default function DmInboxPage() {
  return (
    <ModulePage
      href="/dashboard/dm-inbox"
      extra={<>
        <DmInboxClient />
        <DmFunnelManager />
        <DmAttribution />
      </>}
    />
  );
}