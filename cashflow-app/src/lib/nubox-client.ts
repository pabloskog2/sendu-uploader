/**
 * Cliente de integración con el facturador de la empresa (piloto: Nubox).
 *
 * A diferencia de Duemint (que solo ve las ventas que la empresa emite), el
 * facturador es donde vive el documento completo en ambos sentidos: compras
 * recibidas y ventas emitidas. Aun así, el vencimiento no siempre viene en
 * el documento — sobre todo en compras, donde no es un dato tributario sino
 * un acuerdo comercial con el proveedor que puede no estar en el DTE. Por
 * eso `dueDate` puede venir `null`: `src/lib/payment-terms.ts` lo resuelve
 * con el plazo de pago configurado (por RUT o por defecto).
 *
 * IMPORTANTE — sin validar contra la API real todavía: no se cuenta con
 * documentación ni credenciales de la API de Nubox en este momento, así
 * que `NuboxApiClient` de abajo es una implementación razonable pero
 * NO CONFIRMADA (endpoints, nombres de campos y forma de paginación son un
 * mejor esfuerzo, no una captura real). Antes de usar `NUBOX_MODE=live`:
 * 1. Conseguir documentación oficial o un HAR real del portal de Nubox
 *    (Red del navegador → exportar ventas/compras), igual como se hizo
 *    antes con el SII y Duemint.
 *  2. Ajustar `NUBOX_API_BASE_URL`, los paths y `mapNuboxDocument()` a la
 *    forma real de la respuesta.
 * Mientras tanto, `NUBOX_MODE=mock` (default) permite construir y probar el
 * resto de la app (UI, sync, flujo de caja) con datos de ejemplo realistas.
 */

import type { NormalizedInvoice, NormalizedInvoiceType } from "@/lib/invoice-types";

export type NuboxCredentials = {
  apiToken: string;
  companyId: string;
};

export interface NuboxClient {
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  fetchInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]>;
}

// Forma supuesta de un documento del facturador — AJUSTAR contra la API real.
type NuboxDocument = {
  id: string;
  direction: "SALE" | "PURCHASE";
  documentType: string; // código DTE del SII, ej: 33 = factura electrónica
  folio: string;
  issueDate: string;
  dueDate: string | null;
  paid: boolean;
  paidDate: string | null;
  net: number;
  taxes: number;
  total: number;
  counterpart: { name: string; taxId: string };
};

type NuboxPage = {
  items: NuboxDocument[];
  page: number;
  pages: number;
};

const BASE_URL = process.env.NUBOX_API_BASE_URL ?? "https://api.nubox.com/v1";
const MAX_PAGES = 50; // resguardo ante una paginación que no responda como se espera

function toDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapNuboxDocument(doc: NuboxDocument): NormalizedInvoice {
  const dueDate = doc.dueDate ? new Date(doc.dueDate) : null;
  let status: NormalizedInvoice["status"] = "PENDING";
  if (doc.paid) {
    status = "PAID";
  } else if (dueDate && dueDate.getTime() < Date.now()) {
    status = "OVERDUE";
  }

  return {
    externalId: doc.id,
    type: doc.direction,
    documentType: doc.documentType,
    status,
    issueDate: new Date(doc.issueDate),
    dueDate,
    paidDate: doc.paidDate ? new Date(doc.paidDate) : null,
    netAmount: doc.net,
    taxAmount: doc.taxes,
    totalAmount: doc.total,
    counterpartName: doc.counterpart?.name,
    counterpartRut: doc.counterpart?.taxId,
    folio: doc.folio,
    currency: "CLP",
    raw: doc,
  };
}

export class NuboxApiClient implements NuboxClient {
  constructor(private credentials: NuboxCredentials) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.apiToken}`,
      companyId: this.credentials.companyId,
    };
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      const today = new Date();
      const res = await this.fetchPage("sales-documents", today, today, 1);
      if (!res.ok) return { ok: false, message: `Nubox respondió ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error de conexión" };
    }
  }

  private fetchPage(path: string, from: Date, to: Date, page: number) {
    const params = new URLSearchParams({
      since: toDateParam(from),
      until: toDateParam(to),
      page: String(page),
    });
    return fetch(`${BASE_URL}/${path}?${params.toString()}`, { headers: this.headers() });
  }

  private async fetchAllPages(path: string, direction: NormalizedInvoiceType, range: { from: Date; to: Date }) {
    const invoices: NormalizedInvoice[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const res = await this.fetchPage(path, range.from, range.to, page);
      if (!res.ok) {
        throw new Error(`Error obteniendo ${direction === "SALE" ? "ventas" : "compras"} desde Nubox: ${res.status}`);
      }
      const data: NuboxPage = await res.json();
      const before = invoices.length;
      invoices.push(...data.items.map(mapNuboxDocument));
      totalPages = data.pages ?? 1;

      if (invoices.length === before && page > 1) break;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);

    return invoices;
  }

  async fetchInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    const [sales, purchases] = await Promise.all([
      this.fetchAllPages("sales-documents", "SALE", range),
      this.fetchAllPages("purchase-documents", "PURCHASE", range),
    ]);
    return [...sales, ...purchases];
  }
}

const MOCK_CLIENT_RUTS = ["76.555.444-3", "76.555.445-1", "76.555.446-K", "76.555.447-8", "76.555.448-6"];
const MOCK_SUPPLIER_RUTS = ["77.111.222-3", "77.111.223-1", "77.111.224-K", "77.111.225-8"];

/**
 * Cliente de demostración: genera ventas y compras de ejemplo. Las ventas
 * siempre traen vencimiento (así emite Nubox sus propios DTE); las compras
 * la mayoría de las veces NO lo traen, para ejercitar la resolución por
 * plazo de pago (ver src/lib/payment-terms.ts) igual que pasaría con datos
 * reales.
 */
export class MockNuboxClient implements NuboxClient {
  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "Conexión simulada (NUBOX_MODE=mock)" };
  }

  async fetchInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    const invoices: NormalizedInvoice[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / oneDay));
    const today = new Date();

    for (let i = 0; i <= totalDays; i += 6) {
      const issueDate = new Date(range.from.getTime() + i * oneDay);
      const clientIdx = (i / 6) % MOCK_CLIENT_RUTS.length;
      const supplierIdx = (i / 6) % MOCK_SUPPLIER_RUTS.length;

      const saleDue = new Date(issueDate.getTime() + 10 * oneDay);
      const saleAmount = 500_000 + ((i * 41) % 10) * 120_000;
      const salePaid = saleDue < today;
      invoices.push({
        externalId: `mock-nubox-sale-${issueDate.toISOString().slice(0, 10)}`,
        type: "SALE",
        documentType: "33",
        status: salePaid ? "PAID" : saleDue < today ? "OVERDUE" : "PENDING",
        issueDate,
        dueDate: saleDue,
        paidDate: salePaid ? saleDue : null,
        netAmount: Math.round(saleAmount / 1.19),
        taxAmount: Math.round(saleAmount - saleAmount / 1.19),
        totalAmount: saleAmount,
        counterpartName: `Cliente demo ${clientIdx + 1}`,
        counterpartRut: MOCK_CLIENT_RUTS[clientIdx],
        folio: `${9000 + i}`,
        currency: "CLP",
        raw: { mock: true },
      });

      // 1 de cada 4 compras sí trae vencimiento propio; el resto queda en
      // null a propósito, para que se resuelva por plazo de pago.
      const purchaseHasDueDate = supplierIdx === 0;
      const purchaseDue = purchaseHasDueDate ? new Date(issueDate.getTime() + 30 * oneDay) : null;
      const purchaseAmount = 300_000 + ((i * 67) % 10) * 90_000;
      const purchasePaid = purchaseHasDueDate && purchaseDue! < today;
      invoices.push({
        externalId: `mock-nubox-purchase-${issueDate.toISOString().slice(0, 10)}`,
        type: "PURCHASE",
        documentType: "33",
        status: purchasePaid ? "PAID" : purchaseDue && purchaseDue < today ? "OVERDUE" : "PENDING",
        issueDate,
        dueDate: purchaseDue,
        paidDate: purchasePaid ? purchaseDue : null,
        netAmount: Math.round(purchaseAmount / 1.19),
        taxAmount: Math.round(purchaseAmount - purchaseAmount / 1.19),
        totalAmount: purchaseAmount,
        counterpartName: `Proveedor demo ${supplierIdx + 1}`,
        counterpartRut: MOCK_SUPPLIER_RUTS[supplierIdx],
        folio: `${5000 + i}`,
        currency: "CLP",
        raw: { mock: true },
      });
    }
    return invoices;
  }
}

export function getNuboxClient(credentials: NuboxCredentials): NuboxClient {
  const mode = process.env.NUBOX_MODE ?? "mock";
  if (mode === "live") return new NuboxApiClient(credentials);
  return new MockNuboxClient();
}
