import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return <ModulePage href="/dashboard/calendar" />;
}
