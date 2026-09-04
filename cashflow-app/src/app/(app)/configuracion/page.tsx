"use client";

import { useEffect, useState } from "react";
import SyncButton from "@/components/SyncButton";

type Org = {
  name: string;
  rut: string | null;
  cashBalance: number;
  cashBalanceDate: string;
  defaultPurchaseTermDays: number;
};

type Connection = {
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
} | null;

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full ${
        status === "CONNECTED"
          ? "bg-green-100 text-income"
          : status === "ERROR"
          ? "bg-red-100 text-expense"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {status === "CONNECTED" ? "Conectado" : status === "ERROR" ? "Error" : "Desconectado"}
    </span>
  );
}

export default function ConfiguracionPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: "",
    rut: "",
    cashBalance: "0",
    cashBalanceDate: "",
    defaultPurchaseTermDays: "30",
  });
  const [savingOrg, setSavingOrg] = useState(false);

  const [siiConnection, setSiiConnection] = useState<Connection>(null);
  const [siiForm, setSiiForm] = useState({ rut: "", claveTributaria: "" });
  const [savingSii, setSavingSii] = useState(false);
  const [siiMessage, setSiiMessage] = useState<string | null>(null);

  const [duemintConnection, setDuemintConnection] = useState<Connection>(null);
  const [duemintForm, setDuemintForm] = useState({ apiToken: "", companyId: "" });
  const [savingDuemint, setSavingDuemint] = useState(false);
  const [duemintMessage, setDuemintMessage] = useState<string | null>(null);

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
          defaultPurchaseTermDays: String(data.defaultPurchaseTermDays ?? 30),
        });
      });
    fetch("/api/sii/connection")
      .then((r) => r.json())
      .then((data) => {
        setSiiConnection(data);
        if (data) setSiiForm({ rut: data.rut ?? "", claveTributaria: "" });
      });
    fetch("/api/duemint/connection")
      .then((r) => r.json())
      .then((data) => {
        setDuemintConnection(data);
        if (data) setDuemintForm({ apiToken: "", companyId: data.companyId ?? "" });
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

  async function saveSii(e: React.FormEvent) {
    e.preventDefault();
    setSavingSii(true);
    setSiiMessage(null);
    const res = await fetch("/api/sii/connection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(siiForm),
    });
    const data = await res.json();
    setSiiConnection(data);
    setSiiMessage(data.status === "CONNECTED" ? "✔ Conexión exitosa" : `❌ ${data.lastError ?? "Error"}`);
    setSavingSii(false);
  }

  async function saveDuemint(e: React.FormEvent) {
    e.preventDefault();
    setSavingDuemint(true);
    setDuemintMessage(null);
    const res = await fetch("/api/duemint/connection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(duemintForm),
    });
    const data = await res.json();
    setDuemintConnection(data);
    setDuemintMessage(data.status === "CONNECTED" ? "✔ Conexión exitosa" : `❌ ${data.lastError ?? "Error"}`);
    setSavingDuemint(false);
  }

  if (!org) return <p className="text-slate-400">Cargando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-brand">Configuración</h1>
        <p className="text-sm text-slate-500">Datos de la empresa y conexiones con SII y Duemint.</p>
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
        <div>
          <label className="label">Plazo de pago por defecto para compras (días)</label>
          <input
            className="input max-w-[140px]"
            type="number"
            min={0}
            value={orgForm.defaultPurchaseTermDays}
            onChange={(e) => setOrgForm({ ...orgForm, defaultPurchaseTermDays: e.target.value })}
          />
          <p className="text-xs text-slate-400 mt-1">
            El SII nunca informa el plazo de pago real de una compra (es un acuerdo con el proveedor, no
            un dato tributario), así que se estima sumando este plazo a la fecha de emisión. Configura un
            plazo específico por proveedor en{" "}
            <a href="/proveedores" className="underline text-brand">
              Proveedores
            </a>
            .
          </p>
        </div>
        <button type="submit" className="btn-primary" disabled={savingOrg}>
          {savingOrg ? "Guardando..." : "Guardar"}
        </button>
      </form>

      <form onSubmit={saveSii} className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Conexión con el SII (compras / egresos)</h2>
          <StatusBadge status={siiConnection?.status} />
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Se guarda tu Clave Tributaria para consultar el Registro de Compras y Venta. Es la misma
          contraseña de tu portal en sii.cl — trátala como una credencial sensible.
        </p>

        <div>
          <label className="label">RUT empresa</label>
          <input
            className="input"
            required
            placeholder="76.123.456-7"
            value={siiForm.rut}
            onChange={(e) => setSiiForm({ ...siiForm, rut: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Clave Tributaria</label>
          <input
            className="input"
            type="password"
            required
            value={siiForm.claveTributaria}
            onChange={(e) => setSiiForm({ ...siiForm, claveTributaria: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-secondary" disabled={savingSii}>
            {savingSii ? "Probando..." : "Guardar y probar conexión"}
          </button>
          {siiMessage && <span className="text-sm text-slate-500">{siiMessage}</span>}
        </div>

        {siiConnection?.lastSyncedAt && (
          <p className="text-xs text-slate-400">
            Última sincronización: {new Date(siiConnection.lastSyncedAt).toLocaleString("es-CL")}
          </p>
        )}

        <div className="pt-2 border-t border-slate-100">
          <SyncButton endpoint="/api/sii/sync" label="Sincronizar SII" />
        </div>
      </form>

      <form onSubmit={saveDuemint} className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Conexión con Duemint (ventas / cobros)</h2>
          <StatusBadge status={duemintConnection?.status} />
        </div>

        <div>
          <label className="label">API Token</label>
          <input
            className="input"
            type="password"
            required
            value={duemintForm.apiToken}
            onChange={(e) => setDuemintForm({ ...duemintForm, apiToken: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Company ID</label>
          <input
            className="input"
            required
            value={duemintForm.companyId}
            onChange={(e) => setDuemintForm({ ...duemintForm, companyId: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-secondary" disabled={savingDuemint}>
            {savingDuemint ? "Probando..." : "Guardar y probar conexión"}
          </button>
          {duemintMessage && <span className="text-sm text-slate-500">{duemintMessage}</span>}
        </div>

        {duemintConnection?.lastSyncedAt && (
          <p className="text-xs text-slate-400">
            Última sincronización: {new Date(duemintConnection.lastSyncedAt).toLocaleString("es-CL")}
          </p>
        )}

        <div className="pt-2 border-t border-slate-100">
          <SyncButton endpoint="/api/duemint/sync" label="Sincronizar Duemint" />
        </div>
      </form>
    </div>
  );
}
