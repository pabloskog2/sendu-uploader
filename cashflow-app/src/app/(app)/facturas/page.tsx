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
  if (source === "NUBOX") return "Nubox";
  return "Manual";
}

type SortField = "dueDate" | "issueDate";
type SortDirection = "desc" | "asc";
type Tab = "SALE" | "PURCHASE";

export default function FacturasPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuboxConnection, setNuboxConnection] = useState<Connection>(null);
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
    fetch("/api/nubox/connection")
      .then((r) => r.json())
      .then(setNuboxConnection);
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

  async function reconcile(id: string) {
    if (!confirm("¿Conciliar esta factura como pagada? Ya no se proyectará en el flujo de caja.")) return;
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcile" }),
    });
    loadInvoices();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Facturas</h1>
          <p className="text-sm text-slate-500">
            Compras y ventas desde Nubox. Duemint (opcional) solo actualiza el estado de pago de las
            ventas.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SyncButton endpoint="/api/nubox/sync" label="Sincronizar Nubox" onSynced={loadInvoices} />
          <SyncButton
            endpoint="/api/duemint/sync"
            label="Actualizar estado de pago (Duemint)"
            onSynced={loadInvoices}
          />
        </div>
      </div>

      {nuboxConnection && nuboxConnection.status !== "CONNECTED" && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          Aún no configuras la conexión con Nubox. Ve a{" "}
          <a href="/configuracion" className="underline font-medium">
            Configuración
          </a>{" "}
          para ingresar tu token y companyId.
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-3">
          <button
            className={`w-40 py-3 text-base ${activeTab === "SALE" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("SALE")}
          >
            Ventas
          </button>
          <button
            className={`w-40 py-3 text-base ${activeTab === "PURCHASE" ? "btn-primary" : "btn-secondary"}`}
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
              <th></th>
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
                <td>
                  {(inv.status === "PENDING" || inv.status === "OVERDUE") && (
                    <button onClick={() => reconcile(inv.id)} className="text-xs underline text-brand">
                      Conciliar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-400 py-8">
                  {activeTab === "SALE"
                    ? "No hay facturas de venta todavía. Sincroniza con Nubox."
                    : "No hay facturas de compra todavía. Sincroniza con Nubox."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
