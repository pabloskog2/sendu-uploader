import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { nuboxConnectionSchema } from "@/lib/validation";
import { getNuboxClient } from "@/lib/nubox-client";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const connection = await prisma.nuboxConnection.findUnique({
    where: { organizationId: session.organizationId },
  });
  return NextResponse.json(connection);
}

export async function PUT(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = nuboxConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = getNuboxClient(parsed.data);
  const test = await client.testConnection();

  const connection = await prisma.nuboxConnection.upsert({
    where: { organizationId: session.organizationId },
    update: {
      ...parsed.data,
      status: test.ok ? "CONNECTED" : "ERROR",
      lastError: test.ok ? null : test.message,
    },
    create: {
      organizationId: session.organizationId,
      ...parsed.data,
      status: test.ok ? "CONNECTED" : "ERROR",
      lastError: test.ok ? null : test.message,
    },
  });

  return NextResponse.json(connection);
}
