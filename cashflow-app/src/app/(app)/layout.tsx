import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  // Se consulta directo a la base (no la sesión JWT) para que el nombre
  // mostrado en el menú refleje al instante lo que se guarde en Configuración.
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { name: true, tradeName: true },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar tradeName={org.tradeName} legalName={org.name} />
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
