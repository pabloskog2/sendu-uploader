import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  getDaysInMonth,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Invoice, OneTimePayment, RecurringPayment, EstimatedSale, Organization } from "@prisma/client";

// Detalle de un movimiento individual dentro de un día, para mostrar en el
// tooltip de la Cartola (qué factura/pago compone ese monto agregado).
export type CashflowLineItem = {
  label: string;
  sub?: string;
  amount: number;
};

export type CashflowDayDetail = {
  invoiceIncome: CashflowLineItem[];
  invoiceExpense: CashflowLineItem[];
  recurringIncome: CashflowLineItem[];
  recurringExpense: CashflowLineItem[];
  oneTimeIncome: CashflowLineItem[];
  oneTimeExpense: CashflowLineItem[];
  estimatedIncome: CashflowLineItem[];
};

export type CashflowDay = {
  date: string; // yyyy-MM-dd
  invoiceIncome: number;
  invoiceExpense: number;
  recurringIncome: number;
  recurringExpense: number;
  oneTimeIncome: number;
  oneTimeExpense: number;
  estimatedIncome: number;
  netChange: number;
  balance: number;
  detail: CashflowDayDetail;
};

export type CashflowProjection = {
  startingBalance: number;
  days: CashflowDay[];
  totals: {
    invoiceIncome: number;
    invoiceExpense: number;
    recurringIncome: number;
    recurringExpense: number;
    oneTimeIncome: number;
    oneTimeExpense: number;
    estimatedIncome: number;
    netChange: number;
    endingBalance: number;
    lowestBalance: number;
    lowestBalanceDate: string;
  };
};

const MAX_OCCURRENCES = 500;

function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Genera las fechas en que cae un pago recurrente dentro de [rangeStart, rangeEnd]. */
export function expandRecurringOccurrences(
  rp: Pick<RecurringPayment, "frequency" | "startDate" | "endDate" | "dayOfMonth" | "weekday" | "active">,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (!rp.active) return [];

  if (rp.frequency === "ONCE") {
    const date = startOfDay(rp.startDate);
    if (isBefore(date, rangeStart) || isAfter(date, rangeEnd)) return [];
    return [date];
  }

  const hardEnd = rp.endDate && isBefore(rp.endDate, rangeEnd) ? rp.endDate : rangeEnd;
  if (isAfter(rp.startDate, hardEnd)) return [];

  let cursor: Date;
  let step: (d: Date) => Date;

  switch (rp.frequency) {
    case "WEEKLY":
    case "BIWEEKLY": {
      const targetWeekday = rp.weekday ?? getDay(rp.startDate);
      cursor = new Date(rp.startDate);
      while (getDay(cursor) !== targetWeekday) {
        cursor = addDays(cursor, 1);
      }
      step = (d) => addWeeks(d, rp.frequency === "WEEKLY" ? 1 : 2);
      break;
    }
    case "ANNUAL": {
      const day = rp.dayOfMonth ?? getDate(rp.startDate);
      let base = new Date(rp.startDate.getFullYear(), rp.startDate.getMonth(), day);
      if (isBefore(base, rp.startDate)) base = addYears(base, 1);
      cursor = base;
      step = (d) => addYears(d, 1);
      break;
    }
    case "MONTHLY":
    default: {
      const day = rp.dayOfMonth ?? getDate(rp.startDate);
      let base = new Date(rp.startDate.getFullYear(), rp.startDate.getMonth(), day);
      if (isBefore(base, rp.startDate)) base = addMonths(base, 1);
      cursor = base;
      step = (d) => addMonths(d, 1);
      break;
    }
  }

  const occurrences: Date[] = [];
  let guard = 0;
  while (!isAfter(cursor, hardEnd) && guard < MAX_OCCURRENCES) {
    if (!isBefore(cursor, rangeStart) && !isAfter(cursor, rangeEnd)) {
      occurrences.push(startOfDay(cursor));
    }
    cursor = step(cursor);
    guard++;
  }
  return occurrences;
}

/** Reparte una venta estimada mensual en montos diarios dentro del rango pedido. */
function distributeEstimatedSale(sale: Pick<EstimatedSale, "periodMonth" | "amount">, rangeStart: Date, rangeEnd: Date) {
  const monthStart = startOfMonth(sale.periodMonth);
  const monthEnd = endOfMonth(sale.periodMonth);
  const daysInMonth = getDaysInMonth(sale.periodMonth);
  const dailyAmount = sale.amount / daysInMonth;

  const overlapStart = isAfter(monthStart, rangeStart) ? monthStart : rangeStart;
  const overlapEnd = isBefore(monthEnd, rangeEnd) ? monthEnd : rangeEnd;
  if (isAfter(overlapStart, overlapEnd)) return [] as { date: Date; amount: number }[];

  return eachDayOfInterval({ start: overlapStart, end: overlapEnd }).map((date) => ({
    date: startOfDay(date),
    amount: dailyAmount,
  }));
}

export async function getCashflowProjection(
  organizationId: string,
  options?: { startDate?: Date; horizonDays?: number }
): Promise<CashflowProjection> {
  const startDate = startOfDay(options?.startDate ?? new Date());
  const horizonDays = options?.horizonDays ?? 90;
  const endDate = startOfDay(addDays(startDate, horizonDays - 1));

  const [org, invoices, recurringPayments, oneTimePayments, estimatedSales] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
    }),
    prisma.recurringPayment.findMany({ where: { organizationId, active: true } }),
    prisma.oneTimePayment.findMany({
      where: { organizationId, date: { gte: startDate, lte: endDate } },
    }),
    prisma.estimatedSale.findMany({ where: { organizationId } }),
  ]);

  const buckets = new Map<string, CashflowDay>();
  for (const d of eachDayOfInterval({ start: startDate, end: endDate })) {
    buckets.set(dayKey(d), {
      date: dayKey(d),
      invoiceIncome: 0,
      invoiceExpense: 0,
      recurringIncome: 0,
      recurringExpense: 0,
      oneTimeIncome: 0,
      oneTimeExpense: 0,
      estimatedIncome: 0,
      netChange: 0,
      balance: 0,
      detail: {
        invoiceIncome: [],
        invoiceExpense: [],
        recurringIncome: [],
        recurringExpense: [],
        oneTimeIncome: [],
        oneTimeExpense: [],
        estimatedIncome: [],
      },
    });
  }

  // Facturas: las vencidas y no pagadas se "arrastran" al primer día de la
  // proyección, ya que el dinero aún no se ha movido.
  for (const inv of invoices) {
    const effectiveDate = isBefore(inv.dueDate, startDate) ? startDate : startOfDay(inv.dueDate);
    if (isAfter(effectiveDate, endDate)) continue;
    const bucket = buckets.get(dayKey(effectiveDate));
    if (!bucket) continue;
    const item: CashflowLineItem = {
      label: inv.counterpartName ?? "Sin contraparte",
      sub: inv.folio ? `Folio ${inv.folio}` : undefined,
      amount: inv.totalAmount,
    };
    if (inv.type === "SALE") {
      bucket.invoiceIncome += inv.totalAmount;
      bucket.detail.invoiceIncome.push(item);
    } else {
      bucket.invoiceExpense += inv.totalAmount;
      bucket.detail.invoiceExpense.push(item);
    }
  }

  for (const rp of recurringPayments) {
    const occurrences = expandRecurringOccurrences(rp, startDate, endDate);
    for (const occ of occurrences) {
      const bucket = buckets.get(dayKey(occ));
      if (!bucket) continue;
      const item: CashflowLineItem = { label: rp.name, amount: rp.amount };
      if (rp.type === "INCOME") {
        bucket.recurringIncome += rp.amount;
        bucket.detail.recurringIncome.push(item);
      } else {
        bucket.recurringExpense += rp.amount;
        bucket.detail.recurringExpense.push(item);
      }
    }
  }

  for (const otp of oneTimePayments) {
    const bucket = buckets.get(dayKey(startOfDay(otp.date)));
    if (!bucket) continue;
    const item: CashflowLineItem = { label: otp.name, amount: otp.amount };
    if (otp.type === "INCOME") {
      bucket.oneTimeIncome += otp.amount;
      bucket.detail.oneTimeIncome.push(item);
    } else {
      bucket.oneTimeExpense += otp.amount;
      bucket.detail.oneTimeExpense.push(item);
    }
  }

  for (const sale of estimatedSales) {
    const portions = distributeEstimatedSale(sale, startDate, endDate);
    for (const p of portions) {
      const bucket = buckets.get(dayKey(p.date));
      if (!bucket) continue;
      bucket.estimatedIncome += p.amount;
      bucket.detail.estimatedIncome.push({
        label: sale.description ?? "Venta estimada",
        sub: "prorrateo mensual",
        amount: p.amount,
      });
    }
  }

  const days = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

  let running = org.cashBalance;
  let lowestBalance = running;
  let lowestBalanceDate = dayKey(startDate);
  const totals = {
    invoiceIncome: 0,
    invoiceExpense: 0,
    recurringIncome: 0,
    recurringExpense: 0,
    oneTimeIncome: 0,
    oneTimeExpense: 0,
    estimatedIncome: 0,
    netChange: 0,
    endingBalance: 0,
    lowestBalance: 0,
    lowestBalanceDate: "",
  };

  for (const day of days) {
    day.netChange =
      day.invoiceIncome -
      day.invoiceExpense +
      day.recurringIncome -
      day.recurringExpense +
      day.oneTimeIncome -
      day.oneTimeExpense +
      day.estimatedIncome;
    running += day.netChange;
    day.balance = running;

    totals.invoiceIncome += day.invoiceIncome;
    totals.invoiceExpense += day.invoiceExpense;
    totals.recurringIncome += day.recurringIncome;
    totals.recurringExpense += day.recurringExpense;
    totals.oneTimeIncome += day.oneTimeIncome;
    totals.oneTimeExpense += day.oneTimeExpense;
    totals.estimatedIncome += day.estimatedIncome;
    totals.netChange += day.netChange;

    if (running < lowestBalance) {
      lowestBalance = running;
      lowestBalanceDate = day.date;
    }
  }

  totals.endingBalance = running;
  totals.lowestBalance = lowestBalance;
  totals.lowestBalanceDate = lowestBalanceDate;

  return {
    startingBalance: org.cashBalance,
    days,
    totals,
  };
}
