import type { NormalizedInvoice, NormalizedInvoiceStatus } from "@/lib/invoice-types";

/**
 * El SII nunca informa la fecha de vencimiento ni la forma de pago de una
 * factura de compra (son un acuerdo comercial con el proveedor, no un dato
 * tributario) — confirmado revisando el detalle real del Registro de
 * Compras y Venta. Por eso ese vencimiento se calcula acá, con el plazo de
 * pago del proveedor si está configurado (Supplier.paymentTermDays), o si
 * no, el plazo por defecto de la organización.
 *
 * 0 días de plazo = contado: se asume pagada el mismo día de emisión, así
 * que no debe proyectarse como egreso futuro.
 */
export function resolvePurchaseInvoice(
  invoice: NormalizedInvoice,
  termDays: number,
  today: Date
): { dueDate: Date; status: NormalizedInvoiceStatus; paidDate: Date | null } {
  const dueDate = new Date(invoice.issueDate.getTime() + termDays * 24 * 60 * 60 * 1000);

  if (termDays <= 0) {
    return { dueDate: invoice.issueDate, status: "PAID", paidDate: invoice.issueDate };
  }

  const status: NormalizedInvoiceStatus = dueDate.getTime() < today.getTime() ? "OVERDUE" : "PENDING";
  return { dueDate, status, paidDate: null };
}
