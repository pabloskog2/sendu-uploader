"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import ConnectionCard from "@/components/ConnectionCard";

type Org = {
  name: string;
  rut: string | null;
  cashBalance: number;
  cashBalanceDate: string;
  defaultPurchaseTermDays: number;
};

type Connection = {
  status: "DISCONNECTED" | "CONNECTED" | "ERROR";
  lastSyncedAt: string | null;
  lastError: string | null;
} | null;

type SiiConnection = (Connection & { rut: string | null }) | null;
type DuemintConnection = (Connection & { companyId: string | null }) | null;

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

  const [siiConnection, setSiiConnection] = useState<SiiConnection>(null);
  const [siiModalOpen, setSiiModalOpen] = useState(false);

  const [duemintConnection, setDuemintConnection] = useState<DuemintConnection>(null);
  const [duemintModalOpen, setDuemintModalOpen] = useState(false);

  function loadOrg() {
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
  }

  function loadSii() {
    fetch("/api/sii/connection")
      .then((r) => r.json())
      .then(setSiiConnection);
  }

  function loadDuemint() {
    fetch("/api/duemint/connection")
      .then((r) => r.json())
      .then(setDuemintConnection);
  }

  useEffect(() => {
    loadOrg();
    loadSii();
    loadDuemint();
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

      <ConnectionCard
        title="Conexión con el SII (compras / egresos)"
        status={siiConnection?.status}
        lastSyncedAt={siiConnection?.lastSyncedAt}
        lastError={siiConnection?.lastError}
        syncEndpoint="/api/sii/sync"
        syncLabel="Sincronizar SII"
        onOpenConfig={() => setSiiModalOpen(true)}
      />

      <ConnectionCard
        title="Conexión con Duemint (ventas / cobros)"
        status={duemintConnection?.status}
        lastSyncedAt={duemintConnection?.lastSyncedAt}
        lastError={duemintConnection?.lastError}
        syncEndpoint="/api/duemint/sync"
        syncLabel="Sincronizar Duemint"
        onOpenConfig={() => setDuemintModalOpen(true)}
      />

      {siiModalOpen && (
        <SiiConfigModal
          initialRut={siiConnection?.rut ?? ""}
          onClose={() => setSiiModalOpen(false)}
          onSaved={() => {
            loadSii();
            setSiiModalOpen(false);
          }}
        />
      )}

      {duemintModalOpen && (
        <DuemintConfigModal
          initialCompanyId={duemintConnection?.companyId ?? ""}
          onClose={() => setDuemintModalOpen(false)}
          onSaved={() => {
            loadDuemint();
            setDuemintModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SiiConfigModal({
  initialRut,
  onClose,
  onSaved,
}: {
  initialRut: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ rut: initialRut, claveTributaria: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/sii/connection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.status === "CONNECTED") {
      onSaved();
    } else {
      setError(data.lastError ?? "No se pudo conectar");
    }
  }

  return (
    <Modal title="Conexión con el SII" onClose={onClose}>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
        Se guarda tu Clave Tributaria para consultar el Registro de Compras y Venta. Es la misma
        contraseña de tu portal en sii.cl — trátala como una credencial sensible.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">RUT empresa</label>
          <input
            className="input"
            required
            placeholder="76.123.456-7"
            value={form.rut}
            onChange={(e) => setForm({ ...form, rut: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Clave Tributaria</label>
          <input
            className="input"
            type="password"
            required
            value={form.claveTributaria}
            onChange={(e) => setForm({ ...form, claveTributaria: e.target.value })}
          />
        </div>
        {error && (
          <p className="text-xs text-expense break-words whitespace-pre-wrap max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Probando..." : "Guardar y probar conexión"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DuemintConfigModal({
  initialCompanyId,
  onClose,
  onSaved,
}: {
  initialCompanyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ apiToken: "", companyId: initialCompanyId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/duemint/connection", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.status === "CONNECTED") {
      onSaved();
    } else {
      setError(data.lastError ?? "No se pudo conectar");
    }
  }

  return (
    <Modal title="Conexión con Duemint" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">API Token</label>
          <input
            className="input"
            type="password"
            required
            value={form.apiToken}
            onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Company ID</label>
          <input
            className="input"
            required
            value={form.companyId}
            onChange={(e) => setForm({ ...form, companyId: e.target.value })}
          />
        </div>
        {error && (
          <p className="text-xs text-expense break-words whitespace-pre-wrap max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Probando..." : "Guardar y probar conexión"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
