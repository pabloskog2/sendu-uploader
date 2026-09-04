import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar organizationName={session.organizationName} />
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
