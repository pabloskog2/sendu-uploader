import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getDuemintClient } from "@/lib/duemint-client";
import { decryptSecret } from "@/lib/crypto";

// Trae cobros desde 6 meses atrás (para detectar vencidos impagos) hasta
// 4 meses hacia adelante (facturas ya emitidas con vencimiento futuro).
const LOOKBACK_DAYS = 180;
const LOOKAHEAD_DAYS = 120;

export async function POST() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const connection = await prisma.duemintConnection.findUnique({
    where: { organizationId: session.organizationId },
  });
  if (!connection?.apiToken || !connection.companyId) {
    return NextResponse.json(
      { error: "Primero configura la conexión con Duemint en Configuración" },
      { status: 400 }
    );
  }

  const log = await prisma.syncLog.create({
    data: { organizationId: session.organizationId, source: "DUEMINT", status: "RUNNING" },
  });

  try {
    const client = getDuemintClient({
      apiToken: decryptSecret(connection.apiToken),
      companyId: connection.companyId,
    });

    const now = new Date();
    const from = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

    const documents = await client.fetchCollectionDocuments({ from, to });

    // Duemint no crea facturas: solo actualiza el estado de pago de las
    // ventas que ya existen (traídas desde el facturador), buscándolas por
    // folio dentro de la misma empresa.
    let updated = 0;
    for (const doc of documents) {
      if (!doc.folio) continue;
      const result = await prisma.invoice.updateMany({
        where: { organizationId: session.organizationId, type: "SALE", folio: doc.folio },
        data: { status: doc.status, paidDate: doc.paidDate },
      });
      updated += result.count;
    }

    await prisma.duemintConnection.update({
      where: { organizationId: session.organizationId },
      data: { status: "CONNECTED", lastSyncedAt: new Date(), lastError: null },
    });
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "SUCCESS", finishedAt: new Date(), invoicesSynced: updated },
    });

    return NextResponse.json({ ok: true, invoicesSynced: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    await prisma.duemintConnection.update({
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
