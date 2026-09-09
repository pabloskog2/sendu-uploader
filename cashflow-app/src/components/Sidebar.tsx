"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Flujo de Caja", icon: "💰" },
  { href: "/facturas", label: "Facturas (Nubox)", icon: "📄" },
  { href: "/plazos-de-pago", label: "Plazos de Pago", icon: "🗓️" },
  { href: "/pagos-recurrentes", label: "Pagos Recurrentes", icon: "🔁" },
  { href: "/ventas-estimadas", label: "Ventas Estimadas", icon: "📈" },
  { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

export default function Sidebar({
  tradeName,
  legalName,
}: {
  tradeName: string | null;
  legalName: string;
}) {
  const pathname = usePathname();
  const displayName = tradeName || legalName;

  return (
    <div className="w-64 shrink-0 bg-brand text-white min-h-screen flex flex-col p-5">
      <div className="mb-8">
        <div className="text-2xl font-bold mb-1 truncate">{displayName}</div>
        {displayName !== legalName && <div className="text-xs text-white/70 truncate">{legalName}</div>}
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? "bg-brand-dark font-medium" : "hover:bg-brand-dark/70"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm text-white/80 hover:text-white text-left px-3 py-2"
      >
        ↩ Cerrar sesión
      </button>
    </div>
  );
}
