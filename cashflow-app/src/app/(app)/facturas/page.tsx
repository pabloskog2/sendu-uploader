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

function sourceLabel(source: string) {
  if (source === "SII") return "SII";
  if (source === "DUEMINT") return "Duemint";
  return "Manual";
}

export default async function FacturasPage() {
  const session = await getCurrentSession();
  const [invoices, siiConnection, duemintConnection] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: session!.organizationId },
      orderBy: { dueDate: "asc" },
    }),
    prisma.siiConnection.findUnique({ where: { organizationId: session!.organizationId } }),
    prisma.duemintConnection.findUnique({ where: { organizationId: session!.organizationId } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Facturas</h1>
          <p className="text-sm text-slate-500">
            Egresos (compras) desde el SII e ingresos (ventas + estado de pago) desde Duemint.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SyncButton endpoint="/api/sii/sync" label="Sincronizar SII (compras)" />
          <SyncButton endpoint="/api/duemint/sync" label="Sincronizar Duemint (ventas)" />
        </div>
      </div>

      {!siiConnection?.rut && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          Aún no configuras la conexión con el SII. Ve a{" "}
          <a href="/configuracion" className="underline font-medium">
            Configuración
          </a>{" "}
          para ingresar tu RUT y Clave Tributaria.
        </div>
      )}
      {!duemintConnection?.apiToken && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          Aún no configuras la conexión con Duemint. Ve a{" "}
          <a href="/configuracion" className="underline font-medium">
            Configuración
          </a>{" "}
          para ingresar tu token y companyId.
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Fuente</th>
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
                <td className="text-slate-500">{sourceLabel(inv.source)}</td>
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
                <td colSpan={8} className="text-center text-slate-400 py-8">
                  No hay facturas todavía. Sincroniza con el SII y/o Duemint.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
