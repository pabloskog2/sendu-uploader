"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { formatCLP } from "@/lib/constants";
import type { CashflowDay } from "@/lib/cashflow-engine";

function formatShortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function CashflowChart({ days }: { days: CashflowDay[] }) {
  const data = days.map((d) => ({ ...d, label: formatShortDate(d.date) }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2a4f7c" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2a4f7c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={30} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`}
            width={45}
          />
          <Tooltip
            formatter={(value: number, name: string) => [formatCLP(value), name]}
            labelFormatter={(label) => `Fecha: ${label}`}
          />
          <ReferenceLine y={0} stroke="#c0392b" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="balance"
            name="Saldo proyectado"
            stroke="#2a4f7c"
            fill="url(#balanceFill)"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
