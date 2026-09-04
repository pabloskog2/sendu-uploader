/**
 * Cliente de integración con Nubox (facturador de Sendu).
 *
 * Nubox emite y guarda las facturas de venta y compra de la empresa. Este
 * adapter las normaliza al formato interno `NormalizedInvoice` para que el
 * motor de flujo de caja (cashflow-engine.ts) las pueda usar sin importar
 * de dónde vinieron.
 *
 * IMPORTANTE: los endpoints exactos de la API de Nubox (rutas, formato de
 * autenticación, nombres de campos) deben confirmarse contra la
 * documentación oficial de Nubox y las credenciales reales de la cuenta.
 * Este archivo deja marcado con TODO cada punto que hay que ajustar una vez
 * se cuente con esa información — el resto de la aplicación (sync, base de
 * datos, UI) no cambia.
 *
 * Mientras tanto, con NUBOX_MODE=mock (valor por defecto) se usa
 * MockNuboxClient para poder demostrar y probar toda la app sin credenciales.
 */

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

export type NuboxCredentials = {
  apiKey: string;
  apiSecret?: string | null;
  companyId: string;
};

export interface NuboxClient {
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  fetchInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]>;
}

/**
 * Implementación real. Requiere credenciales válidas y confirmar los
 * endpoints con la documentación de Nubox.
 */
export class NuboxApiClient implements NuboxClient {
  private baseUrl: string;

  constructor(private credentials: NuboxCredentials) {
    this.baseUrl = process.env.NUBOX_API_BASE_URL ?? "https://api.nubox.com";
  }

  private authHeaders(): Record<string, string> {
    // TODO: confirmar esquema real de autenticación de la API de Nubox
    // (puede ser Bearer token, API key en header propio, o firma con
    // apiSecret). Ajustar aquí una vez se tengan las credenciales.
    return {
      Authorization: `Bearer ${this.credentials.apiKey}`,
      "X-Nubox-Company-Id": this.credentials.companyId,
      "Content-Type": "application/json",
    };
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      // TODO: reemplazar por un endpoint liviano real (p.ej. /companies/{id})
      const res = await fetch(`${this.baseUrl}/v1/companies/${this.credentials.companyId}`, {
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        return { ok: false, message: `Nubox respondió ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error de conexión" };
    }
  }

  async fetchInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    // TODO: confirmar rutas reales. Se asume un endpoint de "documentos de
    // venta" y otro de "documentos de compra" que aceptan rango de fechas.
    const [sales, purchases] = await Promise.all([
      this.fetchDocuments("sales", range),
      this.fetchDocuments("purchases", range),
    ]);
    return [...sales, ...purchases];
  }

  private async fetchDocuments(
    kind: "sales" | "purchases",
    range: { from: Date; to: Date }
  ): Promise<NormalizedInvoice[]> {
    const params = new URLSearchParams({
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
    });
    const res = await fetch(`${this.baseUrl}/v1/${kind}?${params.toString()}`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Error obteniendo ${kind} desde Nubox: ${res.status}`);
    }
    const data = await res.json();
    const documents: unknown[] = Array.isArray(data) ? data : data.items ?? data.documents ?? [];
    return documents.map((doc) => mapNuboxDocument(doc, kind === "sales" ? "SALE" : "PURCHASE"));
  }
}

/** Ajustar según la forma real de un documento devuelto por Nubox. */
function mapNuboxDocument(doc: any, type: NormalizedInvoiceType): NormalizedInvoice {
  return {
    externalId: String(doc.id ?? doc.folio),
    type,
    documentType: doc.tipoDocumento ?? doc.document_type,
    status: mapNuboxStatus(doc.estado ?? doc.status),
    issueDate: new Date(doc.fechaEmision ?? doc.issue_date),
    dueDate: new Date(doc.fechaVencimiento ?? doc.due_date ?? doc.fechaEmision ?? doc.issue_date),
    paidDate: doc.fechaPago ? new Date(doc.fechaPago) : null,
    netAmount: Number(doc.montoNeto ?? doc.net_amount ?? 0),
    taxAmount: Number(doc.montoIva ?? doc.tax_amount ?? 0),
    totalAmount: Number(doc.montoTotal ?? doc.total_amount ?? 0),
    counterpartName: doc.razonSocial ?? doc.counterpart_name,
    counterpartRut: doc.rut ?? doc.counterpart_rut,
    folio: doc.folio ? String(doc.folio) : undefined,
    currency: doc.moneda ?? "CLP",
    raw: doc,
  };
}

function mapNuboxStatus(raw: unknown): NormalizedInvoiceStatus {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("pagad")) return "PAID";
  if (value.includes("anulad") || value.includes("void")) return "VOID";
  if (value.includes("vencid")) return "OVERDUE";
  return "PENDING";
}

/**
 * Cliente de demostración: genera facturas de ejemplo deterministas
 * (mismos resultados en cada sync) para poder usar y mostrar la app sin
 * credenciales reales de Nubox.
 */
export class MockNuboxClient implements NuboxClient {
  constructor(private companyId: string) {}

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "Conexión simulada (NUBOX_MODE=mock)" };
  }

  async fetchInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    const invoices: NormalizedInvoice[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / oneDay));
    const today = startOfDay(new Date());

    for (let i = 0; i <= totalDays; i += 5) {
      const issueDate = new Date(range.from.getTime() + i * oneDay);
      const dueDate = new Date(issueDate.getTime() + 30 * oneDay);
      const amount = 800000 + ((i * 37) % 12) * 150000;
      invoices.push({
        externalId: `mock-sale-${this.companyId}-${issueDate.toISOString().slice(0, 10)}`,
        type: "SALE",
        documentType: "factura",
        status: dueDate < today ? "PAID" : "PENDING",
        issueDate,
        dueDate,
        paidDate: dueDate < today ? dueDate : null,
        netAmount: Math.round(amount / 1.19),
        taxAmount: Math.round(amount - amount / 1.19),
        totalAmount: amount,
        counterpartName: `Cliente demo ${(i % 6) + 1}`,
        counterpartRut: "76.123.456-7",
        folio: `${1000 + i}`,
        currency: "CLP",
        raw: { mock: true },
      });
    }

    for (let i = 0; i <= totalDays; i += 7) {
      const issueDate = new Date(range.from.getTime() + i * oneDay);
      const dueDate = new Date(issueDate.getTime() + 15 * oneDay);
      const amount = 300000 + ((i * 53) % 9) * 90000;
      invoices.push({
        externalId: `mock-purchase-${this.companyId}-${issueDate.toISOString().slice(0, 10)}`,
        type: "PURCHASE",
        documentType: "factura",
        status: dueDate < today ? "PAID" : "PENDING",
        issueDate,
        dueDate,
        paidDate: dueDate < today ? dueDate : null,
        netAmount: Math.round(amount / 1.19),
        taxAmount: Math.round(amount - amount / 1.19),
        totalAmount: amount,
        counterpartName: `Proveedor demo ${(i % 4) + 1}`,
        counterpartRut: "77.987.654-3",
        folio: `${5000 + i}`,
        currency: "CLP",
        raw: { mock: true },
      });
    }

    return invoices;
  }
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getNuboxClient(credentials: NuboxCredentials): NuboxClient {
  const mode = process.env.NUBOX_MODE ?? "mock";
  if (mode === "live") {
    return new NuboxApiClient(credentials);
  }
  return new MockNuboxClient(credentials.companyId);
}
