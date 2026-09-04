"use client";

import { useEffect, useState } from "react";
import { CONFIDENCE_LEVELS, formatCLP } from "@/lib/constants";

type EstimatedSale = {
  id: string;
  periodMonth: string;
  amount: number;
  description: string | null;
  confidence: string;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

export default function VentasEstimadasPage() {
  const [items, setItems] = useState<EstimatedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    periodMonth: currentMonth(),
    amount: "",
    description: "",
    confidence: "MEDIUM",
  });
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/estimated-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodMonth: `${form.periodMonth}-01`,
        amount: Number(form.amount),
        description: form.description || null,
        confidence: form.confidence,
      }),
    });

    if (!res.ok) {
      setError("No se pudo guardar la venta estimada.");
    } else {
      setForm({ ...form, amount: "", description: "" });
      await load();
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta venta estimada?")) return;
    await fetch(`/api/estimated-sales/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">Ventas Estimadas</h1>
        <p className="text-sm text-slate-500">
          Proyecta ingresos futuros aún no facturados. Se reparten día a día dentro del mes seleccionado
          en el flujo de caja.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="label">Mes</label>
          <input
            className="input"
            type="month"
            required
            value={form.periodMonth}
            onChange={(e) => setForm({ ...form, periodMonth: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Monto estimado (CLP)</label>
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
        <div className="md:col-span-4 flex items-center gap-3">
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
              <th>Mes</th>
              <th>Descripción</th>
              <th>Confianza</th>
              <th className="text-right">Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="capitalize">{monthLabel(item.periodMonth)}</td>
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
                <td colSpan={5} className="text-center text-slate-400 py-8">
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
