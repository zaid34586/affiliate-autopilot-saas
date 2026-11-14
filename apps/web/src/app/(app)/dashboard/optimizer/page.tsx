import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import OptimizerDashboard from "./optimizer-dashboard";

export const metadata: Metadata = { title: "Auto-Optimizer" };

export default function OptimizerPage() {
  return (
    <ModulePage
      href="/dashboard/optimizer"
      extra={<OptimizerDashboard />}
    />
  );
}