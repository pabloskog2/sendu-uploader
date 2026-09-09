"use client";

import { useRef, useState } from "react";
import { formatCLP } from "@/lib/constants";
import type { CashflowLineItem } from "@/lib/cashflow-engine";

const TOOLTIP_WIDTH = 288; // px, matches w-72

export default function HoverAmountCell({
  amount,
  items,
  emptyLabel,
  className,
}: {
  amount: number;
  items: CashflowLineItem[];
  emptyLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);

  function handleEnter() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const above = window.innerHeight - rect.bottom < 220;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, TOOLTIP_WIDTH / 2 + 8),
      window.innerWidth - TOOLTIP_WIDTH / 2 - 8
    );
    setPos({ top: above ? rect.top - 8 : rect.bottom + 8, left, above });
  }

  return (
    <td
      ref={ref}
      className={`cursor-default ${className ?? ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
    >
      {formatCLP(amount)}
      {pos && (
        <div
          className="fixed z-50 w-72 rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-left text-xs text-slate-600"
          style={{
            top: pos.top,
            left: pos.left,
            transform: `translate(-50%, ${pos.above ? "-100%" : "0"})`,
          }}
        >
          {items.length === 0 ? (
            <p className="text-slate-400">{emptyLabel}</p>
          ) : (
            <ul className="space-y-1.5 max-h-56 overflow-y-auto">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">
                    {it.label}
                    {it.sub ? <span className="text-slate-400"> · {it.sub}</span> : null}
                  </span>
                  <span className="font-medium shrink-0">{formatCLP(it.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </td>
  );
}
