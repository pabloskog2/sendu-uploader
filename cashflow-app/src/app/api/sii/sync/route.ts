import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getSiiClient } from "@/lib/sii-client";
import { decryptSecret } from "@/lib/crypto";
import { resolvePurchaseInvoice } from "@/lib/purchase-terms";
import { normalizeRut } from "@/lib/rut";

// Trae compras desde 6 meses atrás (para detectar vencidas impagas) hasta
// 4 meses hacia adelante (documentos ya emitidos con vencimiento futuro).
const LOOKBACK_DAYS = 180;
const LOOKAHEAD_DAYS = 120;

export async function POST() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [connection, org] = await Promise.all([
    prisma.siiConnection.findUnique({ where: { organizationId: session.organizationId } }),
    prisma.organization.findUniqueOrThrow({ where: { id: session.organizationId } }),
  ]);
  if (!connection?.rut || !connection.claveTributaria) {
    return NextResponse.json(
      { error: "Primero configura la conexión con el SII en Configuración" },
      { status: 400 }
    );
  }

  const log = await prisma.syncLog.create({
    data: { organizationId: session.organizationId, source: "SII", status: "RUNNING" },
  });

  try {
    const client = getSiiClient({
      rut: connection.rut,
      claveTributaria: decryptSecret(connection.claveTributaria),
    });

    const now = new Date();
    const from = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

    const [invoices, suppliers] = await Promise.all([
      client.fetchPurchaseInvoices({ from, to }),
      prisma.supplier.findMany({ where: { organizationId: session.organizationId } }),
    ]);
    const suppliersByRut = new Map(suppliers.map((s) => [normalizeRut(s.rut), s]));

    for (const inv of invoices) {
      const supplier = inv.counterpartRut ? suppliersByRut.get(normalizeRut(inv.counterpartRut)) : undefined;
      const termDays = supplier?.paymentTermDays ?? org.defaultPurchaseTermDays;
      const resolved = resolvePurchaseInvoice(inv, termDays, now);

      const data = {
        type: inv.type,
        documentType: inv.documentType,
        status: resolved.status,
        issueDate: inv.issueDate,
        dueDate: resolved.dueDate,
        paidDate: resolved.paidDate,
        netAmount: inv.netAmount,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        counterpartName: inv.counterpartName,
        counterpartRut: inv.counterpartRut,
        folio: inv.folio,
        currency: inv.currency,
        raw: JSON.stringify(inv.raw),
      };

      await prisma.invoice.upsert({
        where: {
          organizationId_source_externalId: {
            organizationId: session.organizationId,
            source: "SII",
            externalId: inv.externalId,
          },
        },
        update: data,
        create: { organizationId: session.organizationId, source: "SII", externalId: inv.externalId, ...data },
      });
    }

    await prisma.siiConnection.update({
      where: { organizationId: session.organizationId },
      data: { status: "CONNECTED", lastSyncedAt: new Date(), lastError: null },
    });
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", finishedAt: new Date(), invoicesSynced: invoices.length },
    });

    return NextResponse.json({ ok: true, invoicesSynced: invoices.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    await prisma.siiConnection.update({
      where: { organizationId: session.organizationId },
      data: { status: "ERROR", lastError: message },
    });
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "ERROR", finishedAt: new Date(), message },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
