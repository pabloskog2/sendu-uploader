"use client";

import { useEffect, useState } from "react";
import { CONFIDENCE_LEVELS, formatCLP } from "@/lib/constants";

type Milestone = { date: string; amount: number };

type EstimatedSale = {
  id: string;
  amount: number;
  description: string | null;
  confidence: string;
  distributionType: "SINGLE" | "PRORATE" | "MILESTONES";
  date: string | null;
  periodMonth: string | null;
  milestones: Milestone[] | null;
};

const DISTRIBUTION_TYPES = [
  { value: "SINGLE", label: "Venta única (una fecha)" },
  { value: "PRORATE", label: "Prorratear en un mes" },
  { value: "MILESTONES", label: "Hitos (varias fechas)" },
] as const;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  // `iso` puede venir como fecha simple (yyyy-MM-dd) o como datetime
  // completo (lo que devuelve la API para el campo `date`, que es un
  // DateTime en la base) — en el segundo caso ya trae hora, no hay que
  // agregarle "T00:00:00" de nuevo.
  const date = iso.length > 10 ? new Date(iso) : new Date(iso + "T00:00:00");
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function monthLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

type MilestoneRow = { date: string; percent: string };

const emptyMilestoneRows: MilestoneRow[] = [
  { date: today(), percent: "50" },
  { date: today(), percent: "50" },
];

export default function VentasEstimadasPage() {
  const [items, setItems] = useState<EstimatedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    distributionType: "PRORATE" as (typeof DISTRIBUTION_TYPES)[number]["value"],
    amount: "",
    description: "",
    confidence: "MEDIUM",
    date: today(),
    periodMonth: currentMonth(),
  });
  const [milestoneRows, setMilestoneRows] = useState<MilestoneRow[]>(emptyMilestoneRows);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/estimated-sales");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totalAmount = Number(form.amount) || 0;
  const percentSum = milestoneRows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);

  function addMilestoneRow() {
    setMilestoneRows([...milestoneRows, { date: today(), percent: "" }]);
  }

  function removeMilestoneRow(i: number) {
    setMilestoneRows(milestoneRows.filter((_, idx) => idx !== i));
  }

  function updateMilestoneRow(i: number, patch: Partial<MilestoneRow>) {
    setMilestoneRows(milestoneRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      amount: totalAmount,
      description: form.description || null,
      confidence: form.confidence,
      distributionType: form.distributionType,
    };

    if (form.distributionType === "SINGLE") {
      payload.date = form.date;
    } else if (form.distributionType === "PRORATE") {
      payload.periodMonth = `${form.periodMonth}-01`;
    } else {
      payload.milestones = milestoneRows
        .filter((r) => r.date && Number(r.percent) > 0)
        .map((r) => ({ date: r.date, amount: Math.round((totalAmount * Number(r.percent)) / 100) }));
    }

    const res = await fetch("/api/estimated-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setError("No se pudo guardar la venta estimada.");
    } else {
      setForm({ ...form, amount: "", description: "" });
      setMilestoneRows(emptyMilestoneRows);
      await load();
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta venta estimada?")) return;
    await fetch(`/api/estimated-sales/${id}`, { method: "DELETE" });
    load();
  }

  function distributionSummary(item: EstimatedSale) {
    if (item.distributionType === "SINGLE") return item.date ? formatDate(item.date) : "-";
    if (item.distributionType === "MILESTONES") {
      const count = item.milestones?.length ?? 0;
      return `${count} hito${count === 1 ? "" : "s"}`;
    }
    return item.periodMonth ? <span className="capitalize">{monthLabel(item.periodMonth)}</span> : "-";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">Ventas Estimadas</h1>
        <p className="text-sm text-slate-500">
          Ingresos proyectados que aún no se facturan (las ventas ya facturadas llegan desde el
          facturador con su propia fecha). Elige cómo cae este ingreso en el flujo de caja: una fecha
          única, prorrateado en un mes, o por hitos de cobro.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Tipo</label>
            <select
              className="input"
              value={form.distributionType}
              onChange={(e) => setForm({ ...form, distributionType: e.target.value as typeof form.distributionType })}
            >
              {DISTRIBUTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Monto total (CLP)</label>
            <input
              className="input"
              type="number"
              required
              min={1}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Confianza</label>
            <select
              className="input"
              value={form.confidence}
              onChange={(e) => setForm({ ...form, confidence: e.target.value })}
            >
              {CONFIDENCE_LEVELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ej: Renovación cliente X"
            />
          </div>
        </div>

        {form.distributionType === "SINGLE" && (
          <div className="max-w-[200px]">
            <label className="label">Fecha</label>
            <input
              className="input"
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
        )}

        {form.distributionType === "PRORATE" && (
          <div className="max-w-[200px]">
            <label className="label">Mes</label>
            <input
              className="input"
              type="month"
              required
              value={form.periodMonth}
              onChange={(e) => setForm({ ...form, periodMonth: e.target.value })}
            />
            <p className="text-xs text-slate-400 mt-1">Se reparte en partes iguales entre los días del mes.</p>
          </div>
        )}

        {form.distributionType === "MILESTONES" && (
          <div className="space-y-2">
            <label className="label mb-0">Hitos de cobro</label>
            {milestoneRows.map((row, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  className="input max-w-[170px]"
                  type="date"
                  value={row.date}
                  onChange={(e) => updateMilestoneRow(i, { date: e.target.value })}
                />
                <div className="flex items-center gap-1">
                  <input
                    className="input max-w-[90px]"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="%"
                    value={row.percent}
                    onChange={(e) => updateMilestoneRow(i, { percent: e.target.value })}
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
                <span className="text-sm text-slate-400 w-32">
                  {formatCLP(Math.round((totalAmount * (Number(row.percent) || 0)) / 100))}
                </span>
                {milestoneRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestoneRow(i)}
                    className="text-xs text-expense underline"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addMilestoneRow} className="text-xs underline text-brand">
              + Agregar hito
            </button>
            <p className={`text-xs ${percentSum === 100 ? "text-slate-400" : "text-expense"}`}>
              Suma: {percentSum}% {percentSum !== 100 && "(debería sumar 100%)"}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar venta estimada"}
          </button>
          {error && <span className="text-sm text-expense">{error}</span>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Cuándo</th>
              <th>Descripción</th>
              <th>Confianza</th>
              <th className="text-right">Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{DISTRIBUTION_TYPES.find((t) => t.value === item.distributionType)?.label}</td>
                <td>{distributionSummary(item)}</td>
                <td>{item.description ?? "-"}</td>
                <td>{CONFIDENCE_LEVELS.find((c) => c.value === item.confidence)?.label}</td>
                <td className="text-right font-medium text-estimate">{formatCLP(item.amount)}</td>
                <td>
                  <button onClick={() => remove(item.id)} className="text-xs text-expense underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400 py-8">
                  Aún no agregas ventas estimadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
