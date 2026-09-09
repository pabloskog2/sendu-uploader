import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { paymentMethodSchema } from "@/lib/validation";

// DEMO: no hay pasarela de pago real — nunca se recibe ni se guarda el
// número completo de la tarjeta ni el CVV, solo lo necesario para mostrar
// la tarjeta guardada (marca, últimos 4 dígitos, vencimiento).
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const method = await prisma.paymentMethod.findUnique({
    where: { organizationId: session.organizationId },
  });
  return NextResponse.json(method);
}

export async function PUT(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = paymentMethodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const method = await prisma.paymentMethod.upsert({
    where: { organizationId: session.organizationId },
    update: parsed.data,
    create: { ...parsed.data, organizationId: session.organizationId },
  });
  return NextResponse.json(method);
}
