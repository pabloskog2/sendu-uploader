"use client";

import SyncButton from "@/components/SyncButton";

type Status = "DISCONNECTED" | "CONNECTED" | "ERROR" | undefined;

function StatusBadge({ status }: { status: Status }) {
  const label = status === "CONNECTED" ? "Conectado" : status === "ERROR" ? "Error" : "No conectado";
  const classes =
    status === "CONNECTED"
      ? "bg-green-100 text-income"
      : status === "ERROR"
      ? "bg-red-100 text-expense"
      : "bg-slate-100 text-slate-500";
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${classes}`}>{label}</span>;
}

export default function ConnectionCard({
  title,
  status,
  lastSyncedAt,
  lastError,
  syncEndpoint,
  syncLabel,
  onOpenConfig,
}: {
  title: string;
  status: Status;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  syncEndpoint: string;
  syncLabel: string;
  onOpenConfig: () => void;
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">{title}</h2>
        <StatusBadge status={status} />
      </div>

      {lastSyncedAt && (
        <p className="text-xs text-slate-400">
          Última sincronización: {new Date(lastSyncedAt).toLocaleString("es-CL")}
        </p>
      )}
      {status === "ERROR" && lastError && (
        <p className="text-xs text-expense break-words">{lastError}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button onClick={onOpenConfig} className="btn-secondary">
          {status === "CONNECTED" ? "Editar conexión" : "Configurar conexión"}
        </button>
        {status === "CONNECTED" && <SyncButton endpoint={syncEndpoint} label={syncLabel} />}
      </div>
    </div>
  );
}
