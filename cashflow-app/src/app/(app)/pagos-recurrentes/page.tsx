"use client";

import { useEffect, useState } from "react";
import {
  RECURRING_CATEGORIES,
  RECURRING_FREQUENCIES,
  PAYMENT_TYPES,
  WEEKDAY_LABELS,
  formatCLP,
} from "@/lib/constants";

type RecurringPayment = {
  id: string;
  name: string;
  category: string;
  type: string;
  amount: number;
  frequency: string;
  dayOfMonth: number | null;
  weekday: number | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

const emptyForm = {
  name: "",
  category: "PREVIRED",
  type: "EXPENSE",
  amount: "",
  frequency: "MONTHLY",
  dayOfMonth: "1",
  weekday: "1",
  startDate: new Date().toISOString().slice(0, 10),
  noEndDate: true,
  endDate: "",
};

export default function PagosRecurrentesPage() {
  const [items, setItems] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/recurring-payments");
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

    const payload = {
      name: form.name,
      category: form.category,
      type: form.type,
      amount: Number(form.amount),
      frequency: form.frequency,
      dayOfMonth: ["MONTHLY", "ANNUAL"].includes(form.frequency) ? Number(form.dayOfMonth) : null,
      weekday: ["WEEKLY", "BIWEEKLY"].includes(form.frequency) ? Number(form.weekday) : null,
      startDate: form.startDate,
      endDate: form.frequency === "ONCE" || form.noEndDate ? null : form.endDate || null,
      active: true,
    };

    const res = await fetch("/api/recurring-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setError("No se pudo guardar. Revisa los datos.");
    } else {
      setForm(emptyForm);
      await load();
    }
    setSaving(false);
  }

  async function toggleActive(item: RecurringPayment) {
    await fetch(`/api/recurring-payments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este pago recurrente?")) return;
    await fetch(`/api/recurring-payments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">Pagos Recurrentes</h1>
        <p className="text-sm text-slate-500">
          Costos fijos no facturables: Previred, remuneraciones, créditos bancarios, arriendos, etc.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="label">Nombre</label>
          <input
            className="input"
            required
            placeholder="Ej: Sueldos equipo administrativo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Categoría</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {RECURRING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {PAYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Monto (CLP)</label>
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
          <label className="label">Frecuencia</label>
          <select
            className="input"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
          >
            {RECURRING_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {["MONTHLY", "ANNUAL"].includes(form.frequency) && (
          <div>
            <label className="label">Día del mes</label>
            <input
              className="input"
              type="number"
              min={1}
              max={28}
              value={form.dayOfMonth}
              onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            />
          </div>
        )}
        {["WEEKLY", "BIWEEKLY"].includes(form.frequency) && (
          <div>
            <label className="label">Día de la semana</label>
            <select
              className="input"
              value={form.weekday}
              onChange={(e) => setForm({ ...form, weekday: e.target.value })}
            >
              {WEEKDAY_LABELS.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Fecha de inicio</label>
          <input
            className="input"
            type="date"
            required
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
        {form.frequency !== "ONCE" && (
          <div>
            <label className="label">Fecha de término</label>
            <label className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <input
                type="checkbox"
                checked={form.noEndDate}
                onChange={(e) => setForm({ ...form, noEndDate: e.target.checked, endDate: "" })}
              />
              Sin fecha de término
            </label>
            {!form.noEndDate && (
              <input
                className="input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            )}
          </div>
        )}

        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Agregar pago recurrente"}
          </button>
          {error && <span className="text-sm text-expense">{error}</span>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Tipo</th>
              <th>Frecuencia</th>
              <th className="text-right">Monto</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={item.active ? "" : "opacity-50"}>
                <td>{item.name}</td>
                <td>{RECURRING_CATEGORIES.find((c) => c.value === item.category)?.label}</td>
                <td className={item.type === "INCOME" ? "text-income" : "text-expense"}>
                  {PAYMENT_TYPES.find((t) => t.value === item.type)?.label}
                </td>
                <td>{RECURRING_FREQUENCIES.find((f) => f.value === item.frequency)?.label}</td>
                <td className="text-right font-medium">{formatCLP(item.amount)}</td>
                <td>
                  <button onClick={() => toggleActive(item)} className="text-xs underline text-brand">
                    {item.active ? "Desactivar" : "Activar"}
                  </button>
                </td>
                <td>
                  <button onClick={() => remove(item.id)} className="text-xs text-expense underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-400 py-8">
                  Aún no agregas pagos recurrentes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
