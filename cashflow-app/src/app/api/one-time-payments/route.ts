import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { oneTimePaymentSchema } from "@/lib/validation";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const items = await prisma.oneTimePayment.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = oneTimePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.oneTimePayment.create({
    data: { ...parsed.data, organizationId: session.organizationId },
  });
  return NextResponse.json(item, { status: 201 });
}
