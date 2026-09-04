// Forma común a la que se normaliza cualquier factura, venga de la fuente
// que venga (SII, Duemint, o una futura), para que el resto de la app
// (sync, motor de flujo de caja, UI) no le importe el origen.

export type NormalizedInvoiceType = "SALE" | "PURCHASE";
export type NormalizedInvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "VOID";

export type NormalizedInvoice = {
  externalId: string;
  type: NormalizedInvoiceType;
  documentType?: string;
  status: NormalizedInvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date | null;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  counterpartName?: string;
  counterpartRut?: string;
  folio?: string;
  currency: string;
  raw: unknown;
};
