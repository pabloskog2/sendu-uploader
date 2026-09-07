/**
 * Cliente de integración con el SII (Servicio de Impuestos Internos, Chile).
 *
 * Se usa solo para traer las facturas de COMPRA (egresos) desde el Registro
 * de Compras y Venta (RCV) — las de venta (ingresos) se obtienen de Duemint
 * (duemint-client.ts), que además informa si ya se pagaron.
 *
 * Importante: el SII (confirmado revisando el detalle real, en dos
 * capturas independientes) **nunca** informa fecha de vencimiento ni forma
 * de pago (contado/crédito) de ninguna compra — no es información
 * tributaria, es un acuerdo comercial privado con cada proveedor. Por eso
 * `NormalizedInvoice.dueDate` que devuelve este cliente es solo un
 * placeholder: `src/lib/purchase-terms.ts` lo recalcula siempre a partir
 * del proveedor (`Supplier.paymentTermDays`) o el plazo por defecto de la
 * organización.
 *
 * ## Cómo funciona `SiiRcvClient` (confirmado con 2 capturas HAR reales)
 *
 * El SII no tiene una API REST pública para terceros — lo que hay es la
 * SPA en Angular que usa el propio portal (`www4.sii.cl/consdcvinternetui`),
 * autenticada por cookie de sesión. Este cliente:
 *
 * 1. Usa un navegador headless (Playwright) para iniciar sesión con RUT +
 *    Clave Tributaria en el formulario real de `zeusr.sii.cl` — necesario
 *    porque el POST de login no quedó capturado en ninguna de las capturas
 *    HAR (todas empezaron con la sesión ya iniciada), así que en vez de
 *    adivinar los parámetros del POST, se automatiza la sesión real del
 *    navegador tal como la usaría una persona.
 *    Selectores **confirmados inspeccionando el HTML real** del formulario
 *    (`#myform` → `#rutcntr`, `#clave`, `#bt_ingresar`): el campo RUT
 *    acepta el valor ya formateado con puntos y guion (ej. "76.886.019-K",
 *    su `maxlength="12"` calza exacto con ese formato — ver
 *    `formatRutWithDots()`). Aun así, un solo intento de login, nunca
 *    reintentar automáticamente (ver riesgos de bloqueo de cuenta en el
 *    README) — el flujo de login en sí sigue sin poder probarse en vivo
 *    desde este entorno (sin salida de red hacia sii.cl).
 * 2. Una vez logueado, hace las llamadas JSON reales **dentro de la página**
 *    (`page.evaluate(fetch(...))`) para que viajen con las mismas cookies,
 *    headers y origen que usaría el navegador — evita tener que replicar
 *    manualmente el manejo de cookies entre dominios (`zeusr.sii.cl` /
 *    `misiir.sii.cl` / `www4.sii.cl`).
 * 3. Por cada mes del rango pedido y cada `estadoContab` (`REGISTRO` =
 *    documentos ya registrados, `PENDIENTE` = recibidos pero aún dentro
 *    del plazo de aceptación/reclamo — igual son compras reales, se
 *    incluyen igual):
 *    - `POST .../facadeService/getResumen` (replica el paso que hace la UI
 *      antes de exportar; no se usa su respuesta, solo por si el backend
 *      espera esa secuencia).
 *    - `POST .../facadeService/getDetalleCompraExport` → devuelve
 *      `{"data": ["<fila CSV con ; como separador>", ...], "nombreArchivo": ...}`.
 *      La primera fila es el encabezado — **el orden y la cantidad de
 *      columnas cambia entre REGISTRO y PENDIENTE** (PENDIENTE no trae
 *      `Fecha Acuse` ni las columnas de tabacos), por eso el parseo
 *      siempre usa el encabezado de cada respuesta, nunca posiciones fijas
 *      (ver `src/lib/csv.ts`).
 *
 * Pendiente de verificar (no se pudo probar en vivo, este entorno no tiene
 * salida de red hacia sii.cl):
 * - El flujo de login completo con credenciales reales — los selectores
 *   están confirmados contra el HTML, pero nadie lo ha corrido de punta a
 *   punta contra el sitio real todavía.
 * - El valor `tokenRecaptcha: "t-o-k-e-n-web"` es literal — así vino en
 *   ambas capturas y funcionó (`codRespuesta: 0`), pero no hay forma de
 *   saber si el SII realmente no valida ese campo en este endpoint o si
 *   fue una coincidencia de esa sesión. Si `SII_MODE=live` empieza a fallar
 *   justo en `getDetalleCompraExport`, revisar esto primero.
 * - Notas de crédito/débito de compra (Tipo Doc 60/61) no se netean contra
 *   el documento que referencian — no había ninguna en los datos de
 *   ejemplo para calibrar esa lógica, así que por ahora entran como una
 *   compra más (podría sobreestimar el egreso si el proveedor emite NC).
 */

import { randomUUID } from "crypto";
import { chromium, type Browser, type Page } from "playwright-core";
import type { NormalizedInvoice } from "@/lib/invoice-types";
import { parseSemicolonCsv, parseSiiDate } from "@/lib/csv";
import { normalizeRut } from "@/lib/rut";

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

const LOGIN_URL = "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html?https://misiir.sii.cl/cgi_misii/siihome.cgi";
const RCV_APP_URL = "https://www4.sii.cl/consdcvinternetui/";
const SESSION_URL = "https://www4.sii.cl/common-1.0/services/aaSessionService/load";
const FACADE_URL = "https://www4.sii.cl/consdcvinternetui/services/data/facadeService";
const NS_GET_RESUMEN = "cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/getResumen";
const NS_GET_DETALLE_COMPRA_EXPORT = "cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/getDetalleCompraExport";
const ESTADOS_CONTAB = ["REGISTRO", "PENDIENTE"] as const;

function splitRut(rut: string): { rutNumerico: string; dv: string } {
  const normalized = normalizeRut(rut);
  return { rutNumerico: normalized.slice(0, -1), dv: normalized.slice(-1) };
}

/**
 * El campo #rutcntr del login acepta el RUT ya formateado con puntos y
 * guion (ej. "76.886.019-K", confirmado inspeccionando el HTML real del
 * formulario) — su maxlength=12 calza exacto con ese formato.
 */
function formatRutWithDots(rut: string): string {
  const normalized = normalizeRut(rut);
  const dv = normalized.slice(-1);
  const body = normalized.slice(0, -1);
  let formatted = "";
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formatted = body[i] + formatted;
    count++;
    if (count % 3 === 0 && i !== 0) formatted = "." + formatted;
  }
  return `${formatted}-${dv}`;
}

function newConversationId(): string {
  return randomUUID().replace(/-/g, "").toUpperCase().slice(0, 13);
}

function monthsBetween(from: Date, to: Date): string[] {
  const periods: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor.getTime() <= end.getTime()) {
    periods.push(`${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}

async function evaluatePost<T>(page: Page, url: string, body: unknown): Promise<T> {
  return page.evaluate(
    async ({ url, body }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/plain, */*" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    { url, body }
  );
}

function mapSiiPurchaseRecord(
  record: Record<string, string>,
  estadoContab: string,
  ptributario: string
): NormalizedInvoice {
  const issueDate = parseSiiDate(record["Fecha Docto"]);
  const totalAmount = Number(record["Monto Total"] || 0);
  const netAmount = Number(record["Monto Neto"] || 0);
  const exemptAmount = Number(record["Monto Exento"] || 0);
  const taxAmount = Math.max(totalAmount - netAmount - exemptAmount, 0);

  return {
    externalId: `${normalizeRut(record["RUT Proveedor"])}-${record["Tipo Doc"]}-${record["Folio"]}`,
    type: "PURCHASE",
    documentType: record["Tipo Doc"],
    // Placeholder: el sync route siempre recalcula dueDate/status/paidDate
    // reales con purchase-terms.ts, ya que el SII no informa esto.
    status: "PENDING",
    issueDate,
    dueDate: issueDate,
    paidDate: null,
    netAmount,
    taxAmount,
    totalAmount,
    counterpartName: record["Razon Social"],
    counterpartRut: record["RUT Proveedor"],
    folio: record["Folio"],
    currency: "CLP",
    raw: { ...record, estadoContab, ptributario },
  };
}

export class SiiRcvClient implements SiiClient {
  constructor(private credentials: SiiCredentials) {}

  private async launchAndLogin(): Promise<{ browser: Browser; page: Page }> {
    const browser = await chromium.launch({
      executablePath: process.env.SII_CHROMIUM_PATH,
      headless: true,
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Selectores confirmados inspeccionando el HTML real del formulario
      // (#rutcntr / #clave / #bt_ingresar dentro de #myform).
      await page.fill("#rutcntr", formatRutWithDots(this.credentials.rut));
      await page.fill("#clave", this.credentials.claveTributaria);
      await page.click("#bt_ingresar");

      // Un solo intento: si no redirige a misiir.sii.cl, es login inválido
      // (o el SII cambió el formulario) — no reintentar automáticamente.
      await page.waitForURL(/misiir\.sii\.cl/, { timeout: 20000 });

      await page.goto(RCV_APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

      const session = await page.evaluate(async (url) => {
        const res = await fetch(url);
        return res.json();
      }, SESSION_URL);

      if (!session?.data?.contribuyente) {
        throw new Error("La sesión del SII no quedó activa después del login");
      }

      return { browser, page };
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    let browser: Browser | undefined;
    try {
      const result = await this.launchAndLogin();
      browser = result.browser;
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Error de conexión" };
    } finally {
      if (browser) await browser.close();
    }
  }

  async fetchPurchaseInvoices(range: { from: Date; to: Date }): Promise<NormalizedInvoice[]> {
    const { browser, page } = await this.launchAndLogin();
    try {
      const { rutNumerico, dv } = splitRut(this.credentials.rut);
      const conversationId = newConversationId();
      const now = new Date();
      const cappedTo = range.to.getTime() < now.getTime() ? range.to : now;
      const periods = monthsBetween(range.from, cappedTo);

      const invoices: NormalizedInvoice[] = [];

      for (const ptributario of periods) {
        for (const estadoContab of ESTADOS_CONTAB) {
          const baseData = {
            rutEmisor: rutNumerico,
            dvEmisor: dv,
            ptributario,
            operacion: "COMPRA",
            estadoContab,
          };

          // Replica el paso que hace la UI real antes de exportar.
          await evaluatePost(page, `${FACADE_URL}/getResumen`, {
            metaData: {
              namespace: NS_GET_RESUMEN,
              conversationId,
              transactionId: randomUUID(),
              page: null,
            },
            data: estadoContab === "REGISTRO" ? { ...baseData, busquedaInicial: true } : baseData,
          });

          const exportRes = await evaluatePost<{ data?: string[] }>(
            page,
            `${FACADE_URL}/getDetalleCompraExport`,
            {
              metaData: {
                namespace: NS_GET_DETALLE_COMPRA_EXPORT,
                conversationId,
                transactionId: randomUUID(),
                page: null,
              },
              data: { ...baseData, codTipoDoc: 0, accionRecaptcha: "RCV_DDETC", tokenRecaptcha: "t-o-k-e-n-web" },
            }
          );

          const rows = exportRes.data ?? [];
          const records = parseSemicolonCsv(rows);
          for (const record of records) {
            invoices.push(mapSiiPurchaseRecord(record, estadoContab, ptributario));
          }
        }
      }

      return invoices;
    } finally {
      await browser.close();
    }
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
