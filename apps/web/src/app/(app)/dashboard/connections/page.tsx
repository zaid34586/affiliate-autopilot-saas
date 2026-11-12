import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { ConnectionsClient } from "./connections-client";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsPage() {
  return (
    <ModulePage
      href="/dashboard/connections"
      extra={<ConnectionsClient />}
    />
  );
}