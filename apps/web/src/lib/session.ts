import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrCreateWorkspace, type Workspace } from "./workspace";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

/** Current user lo — logged in nahi toh /login pe bhej do. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/login");
  return user as SessionUser;
}

/** Current user + uska workspace (na mile toh bana deta hai). */
export async function requireWorkspace(): Promise<{
  user: SessionUser;
  workspace: Workspace;
}> {
  const user = await requireUser();
  const workspace = await getOrCreateWorkspace(user.id);
  return { user, workspace };
}
