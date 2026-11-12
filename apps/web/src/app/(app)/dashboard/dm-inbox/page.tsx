import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "DM Inbox" };

export default function DmInboxPage() {
  return <ModulePage href="/dashboard/dm-inbox" />;
}
