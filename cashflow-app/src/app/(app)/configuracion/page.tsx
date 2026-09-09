"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import ConnectionCard from "@/components/ConnectionCard";
import { formatCLP, USER_ROLES } from "@/lib/constants";

type Org = {
  name: string;
  tradeName: string | null;
  rut: string | null;
};

type Connection = {
  status: "DISCONNECTED" | "CONNECTED" | "ERROR";
  lastSyncedAt: string | null;
  lastError: string | null;
} | null;

type NuboxConnection = (Connection & { companyId: string | null }) | null;
type DuemintConnection = (Connection & { companyId: string | null }) | null;

const TABS = [
  { value: "empresa", label: "Empresa" },
  { value: "integraciones", label: "Integraciones" },
  { value: "usuarios", label: "Usuarios" },
  { value: "pagos", label: "Pagos" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("empresa");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-brand">Configuración</h1>
        <p className="text-sm text-slate-500">Empresa, integraciones, usuarios y facturación de Sendu.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`min-w-[140px] px-6 py-3 text-base ${t.value === tab ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "empresa" && <EmpresaTab />}
      {tab === "integraciones" && <IntegracionesTab />}
      {tab === "usuarios" && <UsuariosTab />}
      {tab === "pagos" && <PagosTab />}
    </div>
  );
}

function EmpresaTab() {
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", tradeName: "", rut: "" });
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((data: Org) => {
        setOrg(data);
        setOrgForm({ name: data.name, tradeName: data.tradeName ?? "", rut: data.rut ?? "" });
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
    router.refresh();
  }

  if (!org) return <p className="text-slate-400">Cargando...</p>;

  return (
    <form onSubmit={saveOrg} className="card space-y-4">
      <h2 className="font-semibold text-slate-700">Empresa</h2>
      <div>
        <label className="label">Nombre de la empresa</label>
        <input
          className="input"
          value={orgForm.tradeName}
          onChange={(e) => setOrgForm({ ...orgForm, tradeName: e.target.value })}
          placeholder="Nombre de fantasía, se muestra en el menú"
        />
      </div>
      <div>
        <label className="label">Razón social</label>
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
  );
}

function IntegracionesTab() {
  const [nuboxConnection, setNuboxConnection] = useState<NuboxConnection>(null);
  const [nuboxModalOpen, setNuboxModalOpen] = useState(false);

  const [duemintConnection, setDuemintConnection] = useState<DuemintConnection>(null);
  const [duemintModalOpen, setDuemintModalOpen] = useState(false);

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
    loadNubox();
    loadDuemint();
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-700">Facturadores</h2>
          <p className="text-xs text-slate-500">
            Fuente de las facturas de compra y venta. Por ahora el único facturador integrado es (Nubox).
          </p>
        </div>
        <ConnectionCard
          title="Nubox"
          status={nuboxConnection?.status}
          lastSyncedAt={nuboxConnection?.lastSyncedAt}
          lastError={nuboxConnection?.lastError}
          syncEndpoint="/api/nubox/sync"
          syncLabel="Sincronizar facturas"
          onOpenConfig={() => setNuboxModalOpen(true)}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-700">Conciliadores</h2>
          <p className="text-xs text-slate-500">
            Actualizan el estado de pago de facturas ya sincronizadas. Por ahora el único conciliador
            integrado es (Duemint).
          </p>
        </div>
        <ConnectionCard
          title="Duemint"
          status={duemintConnection?.status}
          lastSyncedAt={duemintConnection?.lastSyncedAt}
          lastError={duemintConnection?.lastError}
          syncEndpoint="/api/duemint/sync"
          syncLabel="Sincronizar conciliación"
          onOpenConfig={() => setDuemintModalOpen(true)}
        />
      </div>

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
    <Modal title="Conexión con el facturador (Nubox)" onClose={onClose}>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
        El facturador (Nubox) es la fuente principal de facturas: trae compras y ventas con su fecha de
        vencimiento real. Usa un token de API de tu cuenta del facturador (Nubox), no tu contraseña de
        acceso al portal.
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
    <Modal title="Conexión con el conciliador (Duemint)" onClose={onClose}>
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2">
        Opcional. Solo actualiza el estado de pago (pagada / pendiente / vencida) de las facturas de
        venta que ya se sincronizaron desde el facturador (Nubox), emparejándolas por folio.
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

type Member = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type Account = { name: string; email: string; role: string };

const emptyNewUserForm = { name: "", email: "", password: "", role: "MEMBER" };

function UsuariosTab() {
  const [account, setAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({ name: "", email: "", password: "" });
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [newUserForm, setNewUserForm] = useState(emptyNewUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  function loadAccount() {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data: Account) => {
        setAccount(data);
        setAccountForm({ name: data.name, email: data.email, password: "" });
      });
  }

  function loadMembers() {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setMembers);
  }

  useEffect(() => {
    loadAccount();
    loadMembers();
  }, []);

  const canManageUsers = account?.role === "OWNER" || account?.role === "ADMIN";

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setAccountMessage(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: accountForm.name,
        email: accountForm.email,
        password: accountForm.password || undefined,
      }),
    });
    setSavingAccount(false);
    if (res.ok) {
      setAccountMessage("✔ Cambios guardados");
      setAccountForm({ ...accountForm, password: "" });
      loadAccount();
    } else {
      const data = await res.json();
      setAccountMessage(`❌ ${typeof data.error === "string" ? data.error : "No se pudo guardar"}`);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    setUserError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUserForm),
    });
    setSavingUser(false);
    if (res.ok) {
      setNewUserForm(emptyNewUserForm);
      loadMembers();
    } else {
      const data = await res.json();
      setUserError(typeof data.error === "string" ? data.error : "No se pudo agregar el usuario");
    }
  }

  async function changeRole(membershipId: string, role: string) {
    const res = await fetch(`/api/users/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(typeof data.error === "string" ? data.error : "No se pudo cambiar el rol");
    }
    loadMembers();
  }

  async function removeMember(membershipId: string) {
    if (!confirm("¿Quitar a este usuario de la empresa?")) return;
    const res = await fetch(`/api/users/${membershipId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(typeof data.error === "string" ? data.error : "No se pudo quitar el usuario");
    }
    loadMembers();
  }

  if (!account) return <p className="text-slate-400">Cargando...</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={saveAccount} className="card space-y-4">
        <h2 className="font-semibold text-slate-700">Mi cuenta</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Correo</label>
            <input
              className="input"
              type="email"
              value={accountForm.email}
              onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nueva contraseña (opcional)</label>
            <input
              className="input"
              type="password"
              placeholder="Dejar vacío para no cambiarla"
              value={accountForm.password}
              onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={savingAccount}>
            {savingAccount ? "Guardando..." : "Guardar"}
          </button>
          {accountMessage && <span className="text-sm text-slate-500">{accountMessage}</span>}
        </div>
      </form>

      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-700">Usuarios de la empresa</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  {canManageUsers ? (
                    <select
                      className="input py-1"
                      value={m.role}
                      onChange={(e) => changeRole(m.membershipId, e.target.value)}
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    USER_ROLES.find((r) => r.value === m.role)?.label
                  )}
                </td>
                <td>
                  {canManageUsers && (
                    <button
                      onClick={() => removeMember(m.membershipId)}
                      className="text-xs text-expense underline"
                    >
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {canManageUsers && (
          <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                required
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Correo</label>
              <input
                className="input"
                type="email"
                required
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Contraseña temporal</label>
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Rol</label>
              <select
                className="input"
                value={newUserForm.role}
                onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
              >
                <option value="MEMBER">Miembro</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div className="md:col-span-4 flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={savingUser}>
                {savingUser ? "Agregando..." : "Agregar usuario"}
              </button>
              {userError && <span className="text-sm text-expense">{userError}</span>}
            </div>
            <p className="md:col-span-4 text-xs text-slate-400">
              Compártele la contraseña temporal por un canal seguro — no hay envío de correo automático
              todavía.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

type PaymentMethod = { brand: string; last4: string; expMonth: number; expYear: number } | null;
type BillingPayment = { id: string; description: string; amount: number; status: string; paidAt: string };

function PagosTab() {
  const [method, setMethod] = useState<PaymentMethod>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  function loadMethod() {
    fetch("/api/billing/payment-method")
      .then((r) => r.json())
      .then(setMethod);
  }

  function loadPayments() {
    fetch("/api/billing/payments")
      .then((r) => r.json())
      .then((data) => {
        setPayments(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadMethod();
    loadPayments();
  }, []);

  return (
    <div className="space-y-6">
      <div className="card bg-amber-50 border-amber-200 text-amber-800 text-xs">
        Demo: todavía no hay una pasarela de pago real conectada. Esta sección simula la experiencia —
        nunca se guarda el número completo de la tarjeta ni el CVV.
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-slate-700">Método de pago</h2>
        {method ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-600">
              {method.brand} •••• {method.last4} · vence {String(method.expMonth).padStart(2, "0")}/
              {method.expYear}
            </p>
            <button onClick={() => setModalOpen(true)} className="btn-secondary">
              Cambiar tarjeta
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-400">Sin método de pago registrado.</p>
            <button onClick={() => setModalOpen(true)} className="btn-primary">
              Agregar tarjeta
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold text-slate-700 mb-4">Historial de pagos</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th className="text-right">Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.paidAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td>{p.description}</td>
                <td className="text-right font-medium">{formatCLP(p.amount)}</td>
                <td className={p.status === "PAID" ? "text-income" : "text-expense"}>
                  {p.status === "PAID" ? "Pagado" : "Fallido"}
                </td>
              </tr>
            ))}
            {!loading && payments.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 py-8">
                  Aún no hay pagos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <CardModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            loadMethod();
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function detectBrand(number: string): "Visa" | "Mastercard" | "Tarjeta" {
  if (number.startsWith("4")) return "Visa";
  if (number.startsWith("5")) return "Mastercard";
  return "Tarjeta";
}

function CardModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const digits = number.replace(/\s/g, "");
    const [mm, yy] = expiry.split("/").map((p) => p.trim());
    const payload = {
      brand: detectBrand(digits),
      last4: digits.slice(-4),
      expMonth: Number(mm),
      expYear: Number(yy?.length === 2 ? `20${yy}` : yy),
    };

    const res = await fetch("/api/billing/payment-method", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      setError("Revisa los datos de la tarjeta.");
    }
  }

  return (
    <Modal title="Agregar tarjeta" onClose={onClose}>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
        Demo: no se procesa un cobro real. Solo se guardan la marca, los últimos 4 dígitos y el
        vencimiento — el número completo y el CVV nunca se envían al servidor.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre en la tarjeta</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Número de tarjeta</label>
          <input
            className="input"
            required
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Vencimiento (MM/AA)</label>
            <input
              className="input"
              required
              placeholder="12/28"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </div>
          <div>
            <label className="label">CVV</label>
            <input
              className="input"
              required
              inputMode="numeric"
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-xs text-expense">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar tarjeta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
