"use client";

import { useEffect, useState } from "react";

type Supplier = {
  id: string;
  rut: string;
  name: string | null;
  paymentTermDays: number | null;
  notes: string | null;
};

const emptyForm = { rut: "", name: "", paymentTermDays: "", notes: "" };

export default function ProveedoresPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/suppliers");
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

    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rut: form.rut,
        name: form.name || null,
        paymentTermDays: form.paymentTermDays === "" ? null : Number(form.paymentTermDays),
        notes: form.notes || null,
      }),
    });

    if (!res.ok) {
      setError("No se pudo guardar el proveedor.");
    } else {
      setForm(emptyForm);
      await load();
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    load();
  }

  function termLabel(days: number | null) {
    if (days === null || days === undefined) return "Plazo por defecto de la empresa";
    if (days === 0) return "Contado";
    return `${days} días`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">Proveedores</h1>
        <p className="text-sm text-slate-500">
          El SII no informa el plazo de pago ni si una compra es al contado — es un acuerdo comercial con
          cada proveedor. Configúralo acá para que el flujo de caja lo use en vez del plazo por defecto.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="label">RUT proveedor</label>
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
            min={0}
            placeholder="Vacío = plazo por defecto"
            value={form.paymentTermDays}
            onChange={(e) => setForm({ ...form, paymentTermDays: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">0 = contado (no se proyecta como egreso futuro)</p>
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
            {saving ? "Guardando..." : "Guardar proveedor"}
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
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.rut}</td>
                <td>{s.name ?? "-"}</td>
                <td>{termLabel(s.paymentTermDays)}</td>
                <td>{s.notes ?? "-"}</td>
                <td>
                  <button onClick={() => remove(s.id)} className="text-xs text-expense underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8">
                  Aún no agregas proveedores. Todas las compras usan el plazo por defecto de la empresa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
