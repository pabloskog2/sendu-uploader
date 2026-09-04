import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { estimatedSaleSchema } from "@/lib/validation";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const items = await prisma.estimatedSale.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { periodMonth: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = estimatedSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const periodMonth = new Date(
    Date.UTC(parsed.data.periodMonth.getUTCFullYear(), parsed.data.periodMonth.getUTCMonth(), 1)
  );

  const item = await prisma.estimatedSale.upsert({
    where: {
      organizationId_periodMonth: {
        organizationId: session.organizationId,
        periodMonth,
      },
    },
    update: {
      amount: parsed.data.amount,
      description: parsed.data.description,
      confidence: parsed.data.confidence,
    },
    create: {
      organizationId: session.organizationId,
      periodMonth,
      amount: parsed.data.amount,
      description: parsed.data.description,
      confidence: parsed.data.confidence,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
