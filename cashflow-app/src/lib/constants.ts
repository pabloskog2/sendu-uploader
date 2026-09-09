export const RECURRING_CATEGORIES = [
  { value: "PREVIRED", label: "Previred (leyes sociales)" },
  { value: "REMUNERACIONES", label: "Remuneraciones" },
  { value: "CREDITO_BANCO", label: "Crédito bancario" },
  { value: "ARRIENDO", label: "Arriendo" },
  { value: "SEGUROS", label: "Seguros" },
  { value: "SOFTWARE", label: "Software / suscripciones" },
  { value: "OTRO", label: "Otro" },
] as const;

export const RECURRING_FREQUENCIES = [
  { value: "ONCE", label: "Pago único" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "ANNUAL", label: "Anual" },
] as const;

export const PAYMENT_TYPES = [
  { value: "EXPENSE", label: "Egreso" },
  { value: "INCOME", label: "Ingreso" },
] as const;

export const ONE_TIME_CATEGORIES = [
  { value: "PROYECTO", label: "Proyecto puntual" },
  { value: "OTRO", label: "Otro" },
] as const;

export const USER_ROLES = [
  { value: "OWNER", label: "Dueño" },
  { value: "ADMIN", label: "Administrador" },
  { value: "MEMBER", label: "Miembro" },
] as const;

export const INVOICE_TYPES = [
  { value: "SALE", label: "Venta (ingreso)" },
  { value: "PURCHASE", label: "Compra (egreso)" },
] as const;

export const INVOICE_STATUSES = [
  { value: "PENDING", label: "Pendiente" },
  { value: "PAID", label: "Pagada" },
  { value: "OVERDUE", label: "Vencida" },
  { value: "VOID", label: "Anulada" },
] as const;

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}
