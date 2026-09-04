/**
 * Cliente de integración con el SII (Servicio de Impuestos Internos, Chile).
 *
 * Se usa solo para traer las facturas de COMPRA (egresos) desde el Registro
 * de Compras y Venta (RCV) — las de venta (ingresos) se obtienen de Duemint
 * (duemint-client.ts), que además informa si ya se pagaron.
 *
 * Importante: el SII (confirmado revisando el detalle real del RCV, tanto
 * en compras como en ventas) **nunca** informa fecha de vencimiento ni
 * forma de pago (contado/crédito) de un documento — es un acuerdo
 * comercial con el proveedor, no un dato tributario. Por eso este cliente
 * ni siquiera intenta leerlo: `NormalizedInvoice.dueDate` que devuelve se
 * descarta siempre y se recalcula en `/api/sii/sync` a partir del plazo de
 * pago del proveedor (`Supplier.paymentTermDays`) o el de la organización
 * (`Organization.defaultPurchaseTermDays`) — ver src/lib/purchase-terms.ts.
 *
 * A diferencia de Duemint, el SII no tiene una API REST pública y
 * documentada para terceros. Lo que existe, y lo que implementaría
 * `SiiRcvClient`, es automatizar la sesión del portal del SII (login con
 * RUT + Clave Tributaria y luego consultar el RCV como lo hace el
 * navegador) — no un cliente de API convencional.
 *
 * DECISIÓN DE PRODUCTO: se optó por avanzar igual con Clave Tributaria
 * (en vez de certificado digital) por simplicidad de onboarding. Ver la
 * sección "Riesgos de usar la Clave Tributaria" en el README antes de
 * activar `SII_MODE=live` con credenciales reales — el riesgo relevante no
 * es que las llamadas sean solo GET (filtrar por fecha no lo reduce), sino
 * guardar la contraseña completa del portal tributario de cada cliente y
 * automatizar logins contra un sitio que no sanciona esto oficialmente.
 * `SiiConnection.claveTributaria` ya se guarda cifrada (ver src/lib/crypto.ts)
 * y nunca se devuelve al frontend (ver src/app/api/sii/connection/route.ts).
 *
 * Endpoints CONFIRMADOS con una captura HAR real (después de iniciar
 * sesión) — quedan documentados para cuando se implemente el login:
 *
 * - `GET https://www4.sii.cl/common-1.0/services/aaSessionService/load`
 *   → `{"data":{"usuario","rut","dv","contribuyente",...}}`. Sirve para
 *   confirmar que la sesión (cookie) sigue activa.
 * - `POST https://www4.sii.cl/consdcvinternetui/services/data/facadeService/getResumen`
 *   con body
 *   `{"metaData":{"namespace":"cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/getResumen","conversationId":"<id de sesión>","transactionId":"<uuid>"},"data":{"rutEmisor":"12345678","dvEmisor":"9","ptributario":"YYYYMM","estadoContab":"REGISTRO","operacion":"COMPRA"|"VENTA"}}`
 *   → devuelve **totales agregados por tipo de documento y mes** (folio,
 *   fecha, contraparte NO vienen acá — es un resumen, no el detalle).
 *
 * Lo que sigue faltando para completar `SiiRcvClient`:
 * - TODO: el POST de login contra `zeusr.sii.cl/AUT2000/InicioAutenticacion/...`
 *   (la captura disponible empezó con la sesión ya iniciada). Sin esto no
 *   se puede autenticar por código.
 * - TODO: el endpoint de detalle por documento individual (folio, fecha de
 *   emisión, RUT de la contraparte) — `getResumen` solo trae el agregado
 *   mensual. Se confirmó además que ni el detalle ni la descarga del RCV
 *   traen vencimiento/forma de pago (ver arriba), así que ese detalle solo
 *   hace falta para reconstruir documentos individuales (folio, fecha,
 *   contraparte, monto), no para el vencimiento.
 * - TODO (seguridad/operacional): un solo intento de login por sync, nunca
 *   reintentar automáticamente una falla de autenticación (riesgo de
 *   bloqueo de la cuenta real del cliente) — ver README.
 */

import type { NormalizedInvoice } from "@/lib/invoice-types";

export type SiiCredentials = {
  rut: string;
  claveTributaria: string;
};

export interface SiiClient {
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  /**
   * El `dueDate` de cada NormalizedInvoice devuelto es solo un placeholder
   * (el SII no lo entrega) — quien llame a este método debe recalcularlo
   * con src/lib/purchase-terms.ts antes de persistirlo.
   */
  fetchPurchaseInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]>;
}

/**
 * TODO: implementación real. Ver los TODOs en el docblock de este archivo
 * para lo que falta (login y detalle por documento).
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

/** Cliente de demostración: compras de ejemplo (sin vencimiento, como en la realidad). */
export class MockSiiClient implements SiiClient {
  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "Conexión simulada (SII_MODE=mock)" };
  }

  async fetchPurchaseInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    const invoices: NormalizedInvoice[] = [];
    const oneDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / oneDay));

    for (let i = 0; i <= totalDays; i += 7) {
      const issueDate = new Date(range.from.getTime() + i * oneDay);
      const amount = 300000 + ((i * 53) % 9) * 90000;

      invoices.push({
        externalId: `mock-sii-purchase-${issueDate.toISOString().slice(0, 10)}`,
        type: "PURCHASE",
        documentType: "33",
        // Placeholder: el sync route siempre recalcula dueDate/status/paidDate
        // reales con purchase-terms.ts, ya que el SII no informa esto.
        status: "PENDING",
        issueDate,
        dueDate: issueDate,
        paidDate: null,
        netAmount: Math.round(amount / 1.19),
        taxAmount: Math.round(amount - amount / 1.19),
        totalAmount: amount,
        counterpartName: `Proveedor demo ${(i % 4) + 1}`,
        counterpartRut: `7711122${(i % 4) + 1}-K`,
        folio: `${5000 + i}`,
        currency: "CLP",
        raw: { mock: true },
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
