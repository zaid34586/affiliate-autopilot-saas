/**
 * Phase 8 — Admin Layout (Server Component)
 * Checks platform admin auth, then renders client sidebar
 */

import { notFound } from "next/navigation";
import { requirePlatformAdmin, getPlatformAdminStatus } from "@/lib/admin/admin-auth";
import AdminSidebar from "./admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    // Plain Error from requirePlatformAdmin would surface as a 500 —
    // non-admins get a 404 instead (matches the API routes' 403).
    notFound();
  }
  const adminStatus = await getPlatformAdminStatus();

  return (
    <div className="min-h-screen bg-ink">
      <AdminSidebar adminEmail={adminStatus.email} />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}