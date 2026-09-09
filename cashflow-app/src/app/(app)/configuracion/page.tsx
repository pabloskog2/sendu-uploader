"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import ConnectionCard from "@/components/ConnectionCard";

type Org = {
  name: string;
  rut: string | null;
};

type Connection = {
  status: "DISCONNECTED" | "CONNECTED" | "ERROR";
  lastSyncedAt: string | null;
  lastError: string | null;
} | null;

type NuboxConnection = (Connection & { companyId: string | null }) | null;
type DuemintConnection = (Connection & { companyId: string | null }) | null;

export default function ConfiguracionPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", rut: "" });
  const [savingOrg, setSavingOrg] = useState(false);

  const [nuboxConnection, setNuboxConnection] = useState<NuboxConnection>(null);
  const [nuboxModalOpen, setNuboxModalOpen] = useState(false);

  const [duemintConnection, setDuemintConnection] = useState<DuemintConnection>(null);
  const [duemintModalOpen, setDuemintModalOpen] = useState(false);

  function loadOrg() {
    fetch("/api/org")
      .then((r) => r.json())
      .then((data: Org) => {
        setOrg(data);
        setOrgForm({ name: data.name, rut: data.rut ?? "" });
      });
  }

  function loadNubox() {
    fetch("/api/nubox/connection")
      .then((r) => r.json())
      .then(setNuboxConnection);
  }

  function loadDuemint() {
    fetch("/api/duemint/connection")
      .then((r) => r.json())
      .then(setDuemintConnection);
  }

  useEffect(() => {
    loadOrg();
    loadNubox();
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
        <p className="text-sm text-slate-500">Datos de la empresa y conexiones con Nubox y Duemint.</p>
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
        <button type="submit" className="btn-primary" disabled={savingOrg}>
          {savingOrg ? "Guardando..." : "Guardar"}
        </button>
      </form>

      <ConnectionCard
        title="Conexión con Nubox (compras y ventas)"
        status={nuboxConnection?.status}
        lastSyncedAt={nuboxConnection?.lastSyncedAt}
        lastError={nuboxConnection?.lastError}
        syncEndpoint="/api/nubox/sync"
        syncLabel="Sincronizar Nubox"
        onOpenConfig={() => setNuboxModalOpen(true)}
      />

      <ConnectionCard
        title="Conexión con Duemint (opcional: solo estado de pago de ventas)"
        status={duemintConnection?.status}
        lastSyncedAt={duemintConnection?.lastSyncedAt}
        lastError={duemintConnection?.lastError}
        syncEndpoint="/api/duemint/sync"
        syncLabel="Actualizar estado de pago"
        onOpenConfig={() => setDuemintModalOpen(true)}
      />

      {nuboxModalOpen && (
        <NuboxConfigModal
          initialCompanyId={nuboxConnection?.companyId ?? ""}
          onClose={() => setNuboxModalOpen(false)}
          onSaved={() => {
            loadNubox();
            setNuboxModalOpen(false);
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

function NuboxConfigModal({
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
    const res = await fetch("/api/nubox/connection", {
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
    <Modal title="Conexión con Nubox" onClose={onClose}>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
        Nubox es la fuente principal de facturas: trae compras y ventas con su fecha de vencimiento
        real. Usa un token de API de tu cuenta Nubox, no tu contraseña de acceso al portal.
      </p>
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
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2">
        Opcional. Solo actualiza el estado de pago (pagada / pendiente / vencida) de las facturas de
        venta que ya se sincronizaron desde Nubox, emparejándolas por folio.
      </p>
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
