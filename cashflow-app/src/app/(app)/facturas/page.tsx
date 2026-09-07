"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCLP, INVOICE_STATUSES } from "@/lib/constants";
import SyncButton from "@/components/SyncButton";

type Invoice = {
  id: string;
  type: "SALE" | "PURCHASE";
  source: string;
  folio: string | null;
  counterpartName: string | null;
  issueDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
};

type Connection = { status: "DISCONNECTED" | "CONNECTED" | "ERROR" } | null;

function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function sourceLabel(source: string) {
  if (source === "SII") return "SII";
  if (source === "DUEMINT") return "Duemint";
  return "Manual";
}

type SortField = "dueDate" | "issueDate";
type SortDirection = "desc" | "asc";
type Tab = "SALE" | "PURCHASE";

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [siiConnection, setSiiConnection] = useState<Connection>(null);
  const [duemintConnection, setDuemintConnection] = useState<Connection>(null);

  const [activeTab, setActiveTab] = useState<Tab>("SALE");
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function loadInvoices() {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data: Invoice[]) => {
        setInvoices(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadInvoices();
    fetch("/api/sii/connection")
      .then((r) => r.json())
      .then(setSiiConnection);
    fetch("/api/duemint/connection")
      .then((r) => r.json())
      .then(setDuemintConnection);
  }, []);

  const rows = useMemo(() => {
    const filtered = invoices.filter((inv) => inv.type === activeTab);
    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
      return sortDirection === "desc" ? -diff : diff;
    });
    return sorted;
  }, [invoices, activeTab, sortField, sortDirection]);

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
          <SyncButton endpoint="/api/sii/sync" label="Sincronizar SII (compras)" onSynced={loadInvoices} />
          <SyncButton endpoint="/api/duemint/sync" label="Sincronizar Duemint (ventas)" onSynced={loadInvoices} />
        </div>
      </div>

      {siiConnection && siiConnection.status !== "CONNECTED" && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          Aún no configuras la conexión con el SII. Ve a{" "}
          <a href="/configuracion" className="underline font-medium">
            Configuración
          </a>{" "}
          para ingresar tu RUT y Clave Tributaria.
        </div>
      )}
      {duemintConnection && duemintConnection.status !== "CONNECTED" && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          Aún no configuras la conexión con Duemint. Ve a{" "}
          <a href="/configuracion" className="underline font-medium">
            Configuración
          </a>{" "}
          para ingresar tu token y companyId.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            className={activeTab === "SALE" ? "btn-primary" : "btn-secondary"}
            onClick={() => setActiveTab("SALE")}
          >
            Ventas
          </button>
          <button
            className={activeTab === "PURCHASE" ? "btn-primary" : "btn-secondary"}
            onClick={() => setActiveTab("PURCHASE")}
          >
            Compras
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <label className="text-slate-500">Ordenar por</label>
          <select
            className="input py-1"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="dueDate">Fecha de vencimiento</option>
            <option value="issueDate">Fecha de emisión</option>
          </select>
          <select
            className="input py-1"
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as SortDirection)}
          >
            <option value="desc">Más futura primero</option>
            <option value="asc">Más antigua primero</option>
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
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
            {rows.map((inv) => (
              <tr key={inv.id}>
                <td className="text-slate-500">{sourceLabel(inv.source)}</td>
                <td>{inv.folio ?? "-"}</td>
                <td>{inv.counterpartName ?? "-"}</td>
                <td>{formatDate(inv.issueDate)}</td>
                <td>{formatDate(inv.dueDate)}</td>
                <td>{labelFor(INVOICE_STATUSES, inv.status)}</td>
                <td className="text-right font-medium">{formatCLP(inv.totalAmount)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-8">
                  {activeTab === "SALE"
                    ? "No hay facturas de venta todavía. Sincroniza con Duemint."
                    : "No hay facturas de compra todavía. Sincroniza con el SII."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
