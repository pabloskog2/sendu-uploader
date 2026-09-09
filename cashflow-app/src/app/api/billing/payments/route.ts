import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const payments = await prisma.billingPayment.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { paidAt: "desc" },
  });
  return NextResponse.json(payments);
}
