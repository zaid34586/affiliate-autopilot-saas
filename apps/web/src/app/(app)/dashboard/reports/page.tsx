import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = { title: "AI Reports" };

export default function ReportsPage() {
  return (
    <ModulePage
      href="/dashboard/reports"
      extra={<ReportsClient />}
    />
  );
}