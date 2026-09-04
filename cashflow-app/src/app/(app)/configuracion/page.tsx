"use client";

import { useEffect, useState } from "react";
import SyncButton from "@/components/SyncButton";

type Org = {
  name: string;
  rut: string | null;
  cashBalance: number;
  cashBalanceDate: string;
};

type Connection = {
  apiKey: string | null;
  companyId: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
} | null;

export default function ConfiguracionPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", rut: "", cashBalance: "0", cashBalanceDate: "" });
  const [savingOrg, setSavingOrg] = useState(false);

  const [connection, setConnection] = useState<Connection>(null);
  const [nuboxForm, setNuboxForm] = useState({ apiKey: "", apiSecret: "", companyId: "" });
  const [savingNubox, setSavingNubox] = useState(false);
  const [nuboxMessage, setNuboxMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((data: Org) => {
        setOrg(data);
        setOrgForm({
          name: data.name,
          rut: data.rut ?? "",
          cashBalance: String(data.cashBalance),
          cashBalanceDate: data.cashBalanceDate.slice(0, 10),
        });
      });
    fetch("/api/nubox/connection")
      .then((r) => r.json())
      .then((data: Connection) => {
        setConnection(data);
        if (data) {
          setNuboxForm({ apiKey: data.apiKey ?? "", apiSecret: "", companyId: data.companyId ?? "" });
        }
      });
  }, []);

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    setSavingOrg(true);
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orgForm),
    });
    setSavingOrg(false);
  }

  async function saveNubox(e: React.FormEvent) {
    e.preventDefault();
    setSavingNubox(true);
    setNuboxMessage(null);
    const res = await fetch("/api/nubox/connection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuboxForm),
    });
    const data = await res.json();
    setConnection(data);
    setNuboxMessage(data.status === "CONNECTED" ? "✔ Conexión exitosa" : `❌ ${data.lastError ?? "Error"}`);
    setSavingNubox(false);
  }

  if (!org) return <p className="text-slate-400">Cargando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-brand">Configuración</h1>
        <p className="text-sm text-slate-500">Datos de la empresa y conexión con Nubox.</p>
      </div>

      <form onSubmit={saveOrg} className="card space-y-4">
        <h2 className="font-semibold text-slate-700">Empresa</h2>
        <div>
          <label className="label">Nombre</label>
          <input
            className="input"
            value={orgForm.name}
            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">RUT</label>
          <input
            className="input"
            value={orgForm.rut}
            onChange={(e) => setOrgForm({ ...orgForm, rut: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Saldo de caja actual (CLP)</label>
            <input
              className="input"
              type="number"
              value={orgForm.cashBalance}
              onChange={(e) => setOrgForm({ ...orgForm, cashBalance: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Fecha del saldo</label>
            <input
              className="input"
              type="date"
              value={orgForm.cashBalanceDate}
              onChange={(e) => setOrgForm({ ...orgForm, cashBalanceDate: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={savingOrg}>
          {savingOrg ? "Guardando..." : "Guardar"}
        </button>
      </form>

      <form onSubmit={saveNubox} className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Conexión con Nubox</h2>
          {connection?.status && (
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                connection.status === "CONNECTED"
                  ? "bg-green-100 text-income"
                  : connection.status === "ERROR"
                  ? "bg-red-100 text-expense"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {connection.status === "CONNECTED"
                ? "Conectado"
                : connection.status === "ERROR"
                ? "Error"
                : "Desconectado"}
            </span>
          )}
        </div>

        <div>
          <label className="label">API Key</label>
          <input
            className="input"
            required
            value={nuboxForm.apiKey}
            onChange={(e) => setNuboxForm({ ...nuboxForm, apiKey: e.target.value })}
          />
        </div>
        <div>
          <label className="label">API Secret (si aplica)</label>
          <input
            className="input"
            type="password"
            value={nuboxForm.apiSecret}
            onChange={(e) => setNuboxForm({ ...nuboxForm, apiSecret: e.target.value })}
          />
        </div>
        <div>
          <label className="label">ID de empresa en Nubox</label>
          <input
            className="input"
            required
            value={nuboxForm.companyId}
            onChange={(e) => setNuboxForm({ ...nuboxForm, companyId: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-secondary" disabled={savingNubox}>
            {savingNubox ? "Probando..." : "Guardar y probar conexión"}
          </button>
          {nuboxMessage && <span className="text-sm text-slate-500">{nuboxMessage}</span>}
        </div>

        {connection?.lastSyncedAt && (
          <p className="text-xs text-slate-400">
            Última sincronización: {new Date(connection.lastSyncedAt).toLocaleString("es-CL")}
          </p>
        )}

        <div className="pt-2 border-t border-slate-100">
          <SyncButton />
        </div>
      </form>
    </div>
  );
}
