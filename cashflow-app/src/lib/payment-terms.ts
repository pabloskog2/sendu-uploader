import type { NormalizedInvoice, NormalizedInvoiceStatus } from "@/lib/invoice-types";
import { normalizeRut } from "@/lib/rut";

/**
 * Nubox no siempre informa la fecha de vencimiento de un documento — sobre
 * todo en compras, donde no es un dato tributario sino un acuerdo comercial
 * con el proveedor, así que puede no venir en el DTE. Cuando falta, se
 * resuelve en este orden de prioridad:
 *   1. La fecha de vencimiento que trae el propio documento (si viene).
 *   2. El plazo configurado para el RUT de la contraparte (PaymentTerm).
 *   3. El plazo por defecto de la organización (Organization.defaultPaymentTermDays).
 *
 * 0 días de plazo = contado: se asume pagada el mismo día de emisión, así
 * que no se proyecta como egreso/ingreso futuro.
 */
export function resolveInvoiceTerms(
  invoice: NormalizedInvoice,
  termsByRut: Map<string, number>,
  defaultDays: number,
  today: Date
): { dueDate: Date; status: NormalizedInvoiceStatus; paidDate: Date | null } {
  if (invoice.dueDate) {
    return { dueDate: invoice.dueDate, status: invoice.status, paidDate: invoice.paidDate ?? null };
  }

  const rut = invoice.counterpartRut ? normalizeRut(invoice.counterpartRut) : null;
  const termDays = (rut ? termsByRut.get(rut) : undefined) ?? defaultDays;

  if (termDays <= 0) {
    return { dueDate: invoice.issueDate, status: "PAID", paidDate: invoice.issueDate };
  }

  const dueDate = new Date(invoice.issueDate.getTime() + termDays * 24 * 60 * 60 * 1000);
  const status: NormalizedInvoiceStatus = dueDate.getTime() < today.getTime() ? "OVERDUE" : "PENDING";
  return { dueDate, status, paidDate: null };
}
