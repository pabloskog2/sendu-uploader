import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { supplierSchema } from "@/lib/validation";
import { normalizeRut } from "@/lib/rut";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rut = normalizeRut(parsed.data.rut);

  const supplier = await prisma.supplier.upsert({
    where: { organizationId_rut: { organizationId: session.organizationId, rut } },
    update: {
      name: parsed.data.name,
      paymentTermDays: parsed.data.paymentTermDays,
      notes: parsed.data.notes,
    },
    create: {
      organizationId: session.organizationId,
      rut,
      name: parsed.data.name,
      paymentTermDays: parsed.data.paymentTermDays,
      notes: parsed.data.notes,
    },
  });
  return NextResponse.json(supplier, { status: 201 });
}
