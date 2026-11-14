import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { TrendMiner } from "./trend-miner";

export const metadata: Metadata = { title: "Trend Miner" };

export default function TrendMinerPage() {
  return (
    <ModulePage
      href="/dashboard/trend-miner"
      extra={<TrendMiner />}
    />
  );
}