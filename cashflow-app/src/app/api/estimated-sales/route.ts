import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { estimatedSaleSchema } from "@/lib/validation";

function toPublicShape(item: { milestones: string | null; [key: string]: unknown }) {
  return { ...item, milestones: item.milestones ? JSON.parse(item.milestones) : null };
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const items = await prisma.estimatedSale.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items.map(toPublicShape));
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = estimatedSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { milestones, periodMonth, ...rest } = parsed.data;

  const item = await prisma.estimatedSale.create({
    data: {
      ...rest,
      organizationId: session.organizationId,
      periodMonth: periodMonth
        ? new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth(), 1))
        : null,
      milestones: milestones ? JSON.stringify(milestones) : null,
    },
  });
  return NextResponse.json(toPublicShape(item), { status: 201 });
}
