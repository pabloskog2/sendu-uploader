import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await prisma.estimatedSale.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.estimatedSale.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
