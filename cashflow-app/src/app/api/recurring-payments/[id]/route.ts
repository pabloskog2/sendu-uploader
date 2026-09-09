import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { recurringPaymentSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await prisma.recurringPayment.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = recurringPaymentSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.recurringPayment.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await prisma.recurringPayment.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.recurringPayment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
