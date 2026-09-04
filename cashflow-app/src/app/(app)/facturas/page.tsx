import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatCLP, INVOICE_STATUSES, INVOICE_TYPES } from "@/lib/constants";
import SyncButton from "@/components/SyncButton";

function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function FacturasPage() {
  const session = await getCurrentSession();
  const [invoices, connection] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: session!.organizationId },
      orderBy: { dueDate: "asc" },
    }),
    prisma.nuboxConnection.findUnique({ where: { organizationId: session!.organizationId } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Facturas</h1>
          <p className="text-sm text-slate-500">
            Ingresos (ventas) y egresos (compras) sincronizados desde Nubox.
          </p>
        </div>
        <SyncButton />
      </div>

      {!connection?.apiKey && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          Aún no configuras la conexión con Nubox. Ve a{" "}
          <a href="/configuracion" className="underline font-medium">
            Configuración
          </a>{" "}
          para ingresar tus credenciales.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Folio</th>
              <th>Contraparte</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className={inv.type === "SALE" ? "text-income" : "text-expense"}>
                  {labelFor(INVOICE_TYPES, inv.type)}
                </td>
                <td>{inv.folio ?? "-"}</td>
                <td>{inv.counterpartName ?? "-"}</td>
                <td>{formatDate(inv.issueDate)}</td>
                <td>{formatDate(inv.dueDate)}</td>
                <td>{labelFor(INVOICE_STATUSES, inv.status)}</td>
                <td className="text-right font-medium">{formatCLP(inv.totalAmount)}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-8">
                  No hay facturas todavía. Presiona "Sincronizar con Nubox".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
