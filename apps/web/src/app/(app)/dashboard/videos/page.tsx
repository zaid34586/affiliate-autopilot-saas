import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { VideosClient } from "./videos-client";

export const metadata: Metadata = { title: "Videos" };

export default function VideosPage() {
  return <ModulePage href="/dashboard/videos" extra={<VideosClient />} />;
}
