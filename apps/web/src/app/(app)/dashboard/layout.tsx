import { requireWorkspace } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, workspace } = await requireWorkspace();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        user={{ name: user.name, email: user.email }}
        workspace={{ name: workspace.name, plan: workspace.plan }}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-7 md:px-8 md:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}
