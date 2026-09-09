"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCLP } from "@/lib/constants";
import CashflowChart from "@/components/CashflowChart";
import HoverAmountCell from "@/components/HoverAmountCell";
import type { CashflowProjection } from "@/lib/cashflow-engine";

const HORIZONS = [30, 60, 90, 120];
const TABS = [
  { value: "resumen", label: "Resumen" },
  { value: "cartola", label: "Cartola" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardClient({
  projection,
  horizon,
}: {
  projection: CashflowProjection;
  horizon: number;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const { totals } = projection;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Flujo de Caja</h1>
          <CashBalanceEditor cashBalance={projection.startingBalance} />
        </div>
        {tab === "resumen" && (
          <div className="flex gap-2">
            {HORIZONS.map((h) => (
              <Link
                key={h}
                href={`/dashboard?horizon=${h}`}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  h === horizon
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-brand border-slate-200 hover:border-brand"
                }`}
              >
                {h} días
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`w-40 py-3 text-base ${t.value === tab ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumen" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard label="Saldo proyectado final" value={formatCLP(totals.endingBalance)} />
            <SummaryCard
              label="Saldo mínimo proyectado"
              value={formatCLP(totals.lowestBalance)}
              sub={formatDate(totals.lowestBalanceDate)}
              negative={totals.lowestBalance < 0}
            />
            <SummaryCard
              label="Ingresos facturados + estimados"
              value={formatCLP(
                totals.invoiceIncome + totals.recurringIncome + totals.oneTimeIncome + totals.estimatedIncome
              )}
            />
            <SummaryCard
              label="Egresos (facturas + recurrentes)"
              value={formatCLP(totals.invoiceExpense + totals.recurringExpense + totals.oneTimeExpense)}
            />
          </div>

          {totals.lowestBalance < 0 && (
            <div className="card border-expense/40 bg-red-50 text-expense text-sm">
              ⚠️ El saldo proyectado cae bajo cero el {formatDate(totals.lowestBalanceDate)}. Revisa tus pagos
              recurrentes o adelanta cobros para cubrir el déficit.
            </div>
          )}

          <div className="card">
            <h2 className="font-semibold text-slate-700 mb-4">Saldo proyectado ({horizon} días)</h2>
            <CashflowChart days={projection.days} />
          </div>
        </>
      ) : (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-slate-700 mb-1">Cartola día a día ({horizon} días)</h2>
          <p className="text-xs text-slate-400 mb-4">Pasa el mouse sobre un monto para ver el detalle.</p>
          <table className="table-base">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="text-right">CxC Duemint</th>
                <th className="text-right">CxC próximo mes</th>
                <th className="text-right">CxP Nubox</th>
                <th className="text-right">CxP manuales</th>
                <th className="text-right">Saldo diario</th>
              </tr>
            </thead>
            <tbody>
              {projection.days.map((d) => (
                <tr key={d.date}>
                  <td>{formatDate(d.date)}</td>
                  <HoverAmountCell
                    amount={d.invoiceIncome}
                    items={d.detail.invoiceIncome}
                    emptyLabel="Sin ventas facturadas este día"
                    className="text-right text-income"
                  />
                  <HoverAmountCell
                    amount={d.estimatedIncome + d.recurringIncome + d.oneTimeIncome}
                    items={[...d.detail.estimatedIncome, ...d.detail.recurringIncome, ...d.detail.oneTimeIncome]}
                    emptyLabel="Sin ingresos manuales este día"
                    className="text-right text-income"
                  />
                  <HoverAmountCell
                    amount={d.invoiceExpense}
                    items={d.detail.invoiceExpense}
                    emptyLabel="Sin compras facturadas este día"
                    className="text-right text-expense"
                  />
                  <HoverAmountCell
                    amount={d.recurringExpense + d.oneTimeExpense}
                    items={[...d.detail.recurringExpense, ...d.detail.oneTimeExpense]}
                    emptyLabel="Sin pagos manuales este día"
                    className="text-right text-expense"
                  />
                  <td className={d.balance >= 0 ? "text-right font-medium" : "text-right font-medium text-expense"}>
                    {formatCLP(d.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CashBalanceEditor({ cashBalance }: { cashBalance: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(cashBalance));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashBalance: Number(value) }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <span className="text-sm text-slate-500">Saldo de caja actual (CLP)</span>
        <input
          className="input w-36 py-1"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button onClick={save} className="btn-primary py-1 px-3 text-sm" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button onClick={() => setEditing(false)} className="btn-secondary py-1 px-3 text-sm">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <p className="text-sm text-slate-500">
      Saldo de caja actual: <span className="font-medium text-slate-700">{formatCLP(cashBalance)}</span>{" "}
      <button onClick={() => setEditing(true)} className="text-xs underline text-brand">
        Editar
      </button>
    </p>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${negative ? "text-expense" : "text-brand"}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
