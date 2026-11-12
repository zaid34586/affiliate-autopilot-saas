import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Videos" };

export default function VideosPage() {
  return <ModulePage href="/dashboard/videos" />;
}
