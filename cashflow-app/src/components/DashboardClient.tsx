"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCLP } from "@/lib/constants";
import CashflowChart from "@/components/CashflowChart";
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

function groupByWeek(days: CashflowProjection["days"]) {
  const weeks: { label: string; income: number; expense: number; net: number; balance: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const income = chunk.reduce(
      (sum, d) => sum + d.invoiceIncome + d.recurringIncome + d.oneTimeIncome + d.estimatedIncome,
      0
    );
    const expense = chunk.reduce((sum, d) => sum + d.invoiceExpense + d.recurringExpense + d.oneTimeExpense, 0);
    weeks.push({
      label: `${formatDate(chunk[0].date)} — ${formatDate(chunk[chunk.length - 1].date)}`,
      income,
      expense,
      net: income - expense,
      balance: chunk[chunk.length - 1].balance,
    });
  }
  return weeks;
}

export default function DashboardClient({
  projection,
  horizon,
}: {
  projection: CashflowProjection;
  horizon: number;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const weeks = groupByWeek(projection.days);
  const { totals } = projection;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Flujo de Caja</h1>
          <p className="text-sm text-slate-500">
            Saldo inicial {formatCLP(projection.startingBalance)} al {formatDate(projection.startingBalanceDate)}
          </p>
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

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={t.value === tab ? "btn-primary" : "btn-secondary"}
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

          <div className="card overflow-x-auto">
            <h2 className="font-semibold text-slate-700 mb-4">Desglose semanal</h2>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Ingresos</th>
                  <th>Egresos</th>
                  <th>Neto</th>
                  <th>Saldo al cierre</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.label}>
                    <td>{w.label}</td>
                    <td className="text-income">{formatCLP(w.income)}</td>
                    <td className="text-expense">{formatCLP(w.expense)}</td>
                    <td className={w.net >= 0 ? "text-income" : "text-expense"}>{formatCLP(w.net)}</td>
                    <td className={w.balance >= 0 ? "font-medium" : "font-medium text-expense"}>
                      {formatCLP(w.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-slate-700 mb-4">Cartola día a día ({horizon} días)</h2>
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
                  <td className="text-right text-income">{formatCLP(d.invoiceIncome)}</td>
                  <td className="text-right text-income">
                    {formatCLP(d.estimatedIncome + d.recurringIncome + d.oneTimeIncome)}
                  </td>
                  <td className="text-right text-expense">{formatCLP(d.invoiceExpense)}</td>
                  <td className="text-right text-expense">{formatCLP(d.recurringExpense + d.oneTimeExpense)}</td>
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
