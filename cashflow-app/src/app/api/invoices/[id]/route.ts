import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

// Conciliar una factura: marcarla pagada manualmente aunque el
// facturador/conciliador todavía no lo reflejen (ej. pago adelantado). Una
// vez conciliada, sale de la proyección de flujo de caja porque ya está
// reflejada en el saldo de caja actual.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  if (body.action !== "reconcile") {
    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  }

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: { status: "PAID", paidDate: new Date() },
  });

  return NextResponse.json(invoice);
}
