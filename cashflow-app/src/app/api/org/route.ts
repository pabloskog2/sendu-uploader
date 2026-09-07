import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { orgSettingsSchema } from "@/lib/validation";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    include: { nuboxConnection: true, duemintConnection: true },
  });
  return NextResponse.json(org);
}

export async function PATCH(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = orgSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const org = await prisma.organization.update({
    where: { id: session.organizationId },
    data: parsed.data,
  });

  return NextResponse.json(org);
}
