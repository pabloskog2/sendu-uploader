/**
 * Cliente de integración con el SII (Servicio de Impuestos Internos, Chile).
 *
 * Se usa solo para traer las facturas de COMPRA (egresos) desde el Registro
 * de Compras y Venta (RCV) — las de venta (ingresos) se obtienen de Duemint
 * (duemint-client.ts), que además informa si ya se pagaron.
 *
 * A diferencia de Duemint, el SII no tiene una API REST pública y
 * documentada para terceros. Lo que existe, y lo que implementaría
 * `SiiRcvClient`, es automatizar la sesión del portal del SII (login con
 * RUT + Clave Tributaria y luego consultar el RCV como lo hace el
 * navegador) — no un cliente de API convencional. Antes de implementarlo
 * en serio hay que resolver:
 *
 * - TODO: mecanismo real de login (el SII usa CAPTCHA/verificaciones en su
 *   portal; puede requerir un navegador headless en vez de fetch simple).
 *   Confirmar además si aceptan una sesión de larga duración o hay que
 *   reautenticar en cada sync.
 * - TODO: endpoint/estructura exacta del RCV de compras una vez autenticado
 *   (es el mismo mecanismo interno que usa la web del SII, no está
 *   públicamente documentado).
 * - TODO (seguridad/legal): esto implica guardar la Clave Tributaria de
 *   cada empresa cliente — cifrarla en reposo y contar con un mandato o
 *   consentimiento explícito, ya que esa clave da acceso al portal
 *   tributario completo, no solo a lectura de facturas.
 *
 * `FchVenc` (fecha de vencimiento) en el DTE es opcional y solo se completa
 * quando la factura se emitió "a crédito" — por eso, si el documento no la
 * trae, se calcula una estimada sumando `defaultTermDays` a la fecha de
 * emisión (configurable por organización).
 */

import type { NormalizedInvoice } from "@/lib/invoice-types";

export type SiiCredentials = {
  rut: string;
  claveTributaria: string;
};

export interface SiiClient {
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  fetchPurchaseInvoices(range: { from: Date; to: Date }, defaultTermDays: number): Promise<NormalizedInvoice[]>;
}

/**
 * TODO: implementación real. Antes de escribir código acá, definir con el
 * equipo si se aborda como automatización de portal (Clave Tributaria,
 * como se decidió) o se reconsidera certificado digital + servicio de
 * facturación electrónica, que sí tiene un contrato de API más estable.
 */
export class SiiRcvClient implements SiiClient {
  constructor(private credentials: SiiCredentials) {}

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    return {
      ok: false,
      message: "Integración real con el SII pendiente de implementar (ver TODOs en sii-client.ts)",
    };
  }

  async fetchPurchaseInvoices(): Promise<NormalizedInvoice[]> {
    throw new Error("Integración real con el SII pendiente de implementar");
  }
}

/** Cliente de demostración: compras de ejemplo, con y sin FchVenc informado. */
export class MockSiiClient implements SiiClient {
  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "Conexión simulada (SII_MODE=mock)" };
  }

  async fetchPurchaseInvoices(
    range: { from: Date; to: Date },
    defaultTermDays: number
  ): Promise<NormalizedInvoice[]> {
    const invoices: NormalizedInvoice[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / oneDay));
    const today = new Date();

    for (let i = 0; i <= totalDays; i += 7) {
      const issueDate = new Date(range.from.getTime() + i * oneDay);
      // La mitad de las facturas de ejemplo no trae FchVenc (simula el caso
      // real de documentos "a crédito" sin ese campo completado).
      const hasVencimiento = i % 14 === 0;
      const dueDate = hasVencimiento
        ? new Date(issueDate.getTime() + 15 * oneDay)
        : new Date(issueDate.getTime() + defaultTermDays * oneDay);
      const amount = 300000 + ((i * 53) % 9) * 90000;

      invoices.push({
        externalId: `mock-sii-purchase-${issueDate.toISOString().slice(0, 10)}`,
        type: "PURCHASE",
        documentType: "33",
        status: dueDate < today ? "PAID" : "PENDING",
        issueDate,
        dueDate,
        paidDate: dueDate < today ? dueDate : null,
        netAmount: Math.round(amount / 1.19),
        taxAmount: Math.round(amount - amount / 1.19),
        totalAmount: amount,
        counterpartName: `Proveedor demo ${(i % 4) + 1}`,
        counterpartRut: "77.111.222-3",
        folio: `${5000 + i}`,
        currency: "CLP",
        raw: { mock: true, fchVencInformado: hasVencimiento },
      });
    }
    return invoices;
  }
}

export function getSiiClient(credentials: SiiCredentials): SiiClient {
  const mode = process.env.SII_MODE ?? "mock";
  if (mode === "live") return new SiiRcvClient(credentials);
  return new MockSiiClient();
}
