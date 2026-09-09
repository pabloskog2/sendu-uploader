import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCashflowProjection } from "@/lib/cashflow-engine";

export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const horizonDays = Number(searchParams.get("horizonDays") ?? 90);

  const projection = await getCashflowProjection(session.organizationId, {
    horizonDays: Number.isFinite(horizonDays) && horizonDays > 0 ? horizonDays : 90,
  });

  return NextResponse.json(projection);
}
