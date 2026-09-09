import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { paymentTermSchema } from "@/lib/validation";
import { normalizeRut } from "@/lib/rut";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const items = await prisma.paymentTerm.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = paymentTermSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.paymentTerm.upsert({
    where: {
      organizationId_rut: {
        organizationId: session.organizationId,
        rut: normalizeRut(parsed.data.rut),
      },
    },
    update: { ...parsed.data, rut: normalizeRut(parsed.data.rut) },
    create: { ...parsed.data, rut: normalizeRut(parsed.data.rut), organizationId: session.organizationId },
  });
  return NextResponse.json(item, { status: 201 });
}
