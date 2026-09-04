"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/nubox/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ ${data.error ?? "Error al sincronizar"}`);
      } else {
        setMessage(`✔ ${data.invoicesSynced} facturas sincronizadas`);
        router.refresh();
      }
    } catch {
      setMessage("❌ Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleSync} className="btn-primary" disabled={loading}>
        {loading ? "Sincronizando..." : "🔄 Sincronizar con Nubox"}
      </button>
      {message && <span className="text-sm text-slate-500">{message}</span>}
    </div>
  );
}
