"use client";

import { useEffect, useState } from "react";

type PaymentTerm = {
  id: string;
  rut: string;
  name: string | null;
  days: number;
  notes: string | null;
};

const emptyForm = { rut: "", name: "", days: "30", notes: "" };

function termLabel(days: number) {
  if (days === 0) return "Contado";
  return `${days} días`;
}

export default function PlazosDePagoPage() {
  const [items, setItems] = useState<PaymentTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/payment-terms");
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

    const res = await fetch("/api/payment-terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rut: form.rut,
        name: form.name || null,
        days: Number(form.days),
        notes: form.notes || null,
      }),
    });

    if (!res.ok) {
      setError("No se pudo guardar. Revisa el RUT y los días.");
    } else {
      setForm(emptyForm);
      await load();
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este plazo de pago?")) return;
    await fetch(`/api/payment-terms/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">Plazos de Pago</h1>
        <p className="text-sm text-slate-500">
          Nubox no siempre trae la fecha de vencimiento de un documento (sobre todo en compras, donde es
          un acuerdo comercial con el proveedor, no un dato tributario). Cuando falta, se usa el plazo
          configurado acá para ese RUT; si no hay uno, se usa el plazo genérico de la empresa
          (Configuración). Aplica tanto a compras como a ventas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="label">RUT (proveedor o cliente)</label>
          <input
            className="input"
            required
            placeholder="77.111.222-3"
            value={form.rut}
            onChange={(e) => setForm({ ...form, rut: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Nombre (opcional)</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Plazo de pago (días)</label>
          <input
            className="input"
            type="number"
            required
            min={0}
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">0 = contado (no se proyecta a futuro)</p>
        </div>
        <div>
          <label className="label">Notas (opcional)</label>
          <input
            className="input"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="md:col-span-4 flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar plazo"}
          </button>
          {error && <span className="text-sm text-expense">{error}</span>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>RUT</th>
              <th>Nombre</th>
              <th>Plazo de pago</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.rut}</td>
                <td>{t.name ?? "-"}</td>
                <td>{termLabel(t.days)}</td>
                <td>{t.notes ?? "-"}</td>
                <td>
                  <button onClick={() => remove(t.id)} className="text-xs text-expense underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8">
                  Aún no configuras plazos por RUT. Todas las facturas sin vencimiento propio usan el
                  plazo genérico de la empresa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
