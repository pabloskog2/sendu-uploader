/**
 * Cliente de integración con Duemint (cobranza), rol acotado: el facturador
 * (Nubox) ya trae la factura de venta completa con su fecha de vencimiento
 * real, así que de esta respuesta solo se usa `status`/`paidDate` para
 * actualizar (nunca crear) la factura correspondiente, emparejando por
 * folio — ver `src/app/api/duemint/sync/route.ts`.
 *
 * Verificado contra una respuesta real de
 * `GET https://api.duemint.com/api/v1/collection-documents`:
 * - Auth: header `Authorization: Bearer <token>` + header `companyId`.
 * - Filtro de fechas: query params `since` y `until`, formato `YYYY-MM-DD`.
 * - Paginación: el body es un array con un único objeto
 *   `{ records: { totalRecords, items, page, pages }, items: [...] }`.
 *   El nombre exacto del query param para pedir la página siguiente no
 *   está confirmado (se asume `page`, ver TODO abajo) — si Duemint lo
 *   ignora, este cliente corta igual apenas deja de recibir items nuevos,
 *   así nunca hace un loop infinito.
 * - El código de `status` (1 = pagado, 2 = por vencer, ...) no está
 *   completamente documentado, así que el estado normalizado se calcula
 *   a partir de los montos (`amountDue`, `paidAmount`) y `dueDate` en vez
 *   de confiar en ese código.
 */

import type { NormalizedInvoice } from "@/lib/invoice-types";

export type DuemintCredentials = {
  apiToken: string;
  companyId: string;
};

export interface DuemintClient {
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  fetchCollectionDocuments(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]>;
}

type DuemintCollectionItem = {
  id: string;
  clientTaxId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: number;
  statusName: string;
  currency: string;
  net: string;
  taxes: string;
  total: string;
  paidAmount: string;
  paidDate: string | null;
  amountDue: number;
  code: number;
  client: { name: string; taxId: string };
};

type DuemintPage = {
  records: { totalRecords: number; items: number; page: number; pages: number };
  items: DuemintCollectionItem[];
};

const BASE_URL = process.env.DUEMINT_API_BASE_URL ?? "https://api.duemint.com/api/v1";
const MAX_PAGES = 50; // resguardo ante una paginación que no responda como se espera

function toDateParam(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mapDuemintItem(item: DuemintCollectionItem): NormalizedInvoice {
  const total = Number(item.total ?? 0);
  const paidAmount = Number(item.paidAmount ?? 0);
  const amountDue = Number(item.amountDue ?? total);
  const dueDate = new Date(item.dueDate);

  let status: NormalizedInvoice["status"] = "PENDING";
  if (amountDue <= 0 && paidAmount > 0) {
    status = "PAID";
  } else if (dueDate.getTime() < Date.now()) {
    status = "OVERDUE";
  }

  return {
    externalId: item.id,
    type: "SALE",
    documentType: String(item.code ?? ""), // código de DTE del SII, ej: 33 = factura electrónica
    status,
    issueDate: new Date(item.issueDate),
    dueDate,
    paidDate: item.paidDate ? new Date(item.paidDate) : null,
    netAmount: Number(item.net ?? 0),
    taxAmount: Number(item.taxes ?? 0),
    totalAmount: total,
    counterpartName: item.client?.name,
    counterpartRut: item.client?.taxId ?? item.clientTaxId,
    folio: item.number,
    currency: item.currency ?? "CLP",
    raw: item,
  };
}

export class DuemintApiClient implements DuemintClient {
  constructor(private credentials: DuemintCredentials) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials.apiToken}`,
      companyId: this.credentials.companyId,
    };
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      const today = new Date();
      const res = await this.fetchPage(today, today, 1);
      if (!res.ok) return { ok: false, message: `Duemint respondió ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error de conexión" };
    }
  }

  private fetchPage(from: Date, to: Date, page: number) {
    const params = new URLSearchParams({
      since: toDateParam(from),
      until: toDateParam(to),
      page: String(page), // TODO: confirmar con la doc si el param de paginación se llama distinto
    });
    return fetch(`${BASE_URL}/collection-documents?${params.toString()}`, {
      headers: this.headers(),
    });
  }

  async fetchCollectionDocuments(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    const invoices: NormalizedInvoice[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const res = await this.fetchPage(range.from, range.to, page);
      if (!res.ok) {
        throw new Error(`Error obteniendo cobros desde Duemint: ${res.status}`);
      }
      const body = await res.json();
      const data: DuemintPage | undefined = Array.isArray(body) ? body[0] : body;
      if (!data) break;

      const before = invoices.length;
      invoices.push(...data.items.map(mapDuemintItem));
      totalPages = data.records?.pages ?? 1;

      // Si pedir la página siguiente no trajo items nuevos, Duemint no está
      // paginando con este param — cortamos en vez de repetir para siempre.
      if (invoices.length === before && page > 1) break;
      page++;
    } while (page <= totalPages && page <= MAX_PAGES);

    return invoices;
  }
}

/** Cliente de demostración con un par de cobros de ejemplo (pagado y pendiente). */
export class MockDuemintClient implements DuemintClient {
  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "Conexión simulada (DUEMINT_MODE=mock)" };
  }

  async fetchCollectionDocuments(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    const invoices: NormalizedInvoice[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / oneDay));
    const today = new Date();

    for (let i = 0; i <= totalDays; i += 6) {
      const issueDate = new Date(range.from.getTime() + i * oneDay);
      const dueDate = new Date(issueDate.getTime() + 10 * oneDay);
      const amount = 500000 + ((i * 41) % 10) * 120000;
      const paid = dueDate < today;
      invoices.push({
        externalId: `mock-duemint-${issueDate.toISOString().slice(0, 10)}`,
        type: "SALE",
        documentType: "33",
        status: paid ? "PAID" : dueDate < today ? "OVERDUE" : "PENDING",
        issueDate,
        dueDate,
        paidDate: paid ? dueDate : null,
        netAmount: Math.round(amount / 1.19),
        taxAmount: Math.round(amount - amount / 1.19),
        totalAmount: amount,
        counterpartName: `Cliente demo ${(i % 5) + 1}`,
        counterpartRut: "76.555.444-3",
        folio: `${9000 + i}`,
        currency: "CLP",
        raw: { mock: true },
      });
    }
    return invoices;
  }
}

export function getDuemintClient(credentials: DuemintCredentials): DuemintClient {
  const mode = process.env.DUEMINT_MODE ?? "mock";
  if (mode === "live") return new DuemintApiClient(credentials);
  return new MockDuemintClient();
}
