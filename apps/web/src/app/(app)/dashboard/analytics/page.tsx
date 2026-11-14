import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { AnalyticsClient } from "./analytics-client";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <ModulePage href="/dashboard/analytics" extra={<AnalyticsClient />} />;
}