import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { nuboxConnectionSchema } from "@/lib/validation";
import { getNuboxClient } from "@/lib/nubox-client";
import { encryptSecret } from "@/lib/crypto";

// Nunca devolver el API Token al frontend, ni siquiera cifrado.
function toPublicShape(connection: {
  companyId: string | null;
  status: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
} | null) {
  if (!connection) return null;
  const { companyId, status, lastSyncedAt, lastError } = connection;
  return { companyId, status, lastSyncedAt, lastError, hasApiToken: !!companyId };
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const connection = await prisma.nuboxConnection.findUnique({
    where: { organizationId: session.organizationId },
  });
  return NextResponse.json(toPublicShape(connection));
}

export async function PUT(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = nuboxConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Probar con el valor en texto plano antes de cifrar y guardar.
  const client = getNuboxClient(parsed.data);
  const test = await client.testConnection();

  const data = {
    companyId: parsed.data.companyId,
    apiToken: encryptSecret(parsed.data.apiToken),
    status: test.ok ? "CONNECTED" : "ERROR",
    lastError: test.ok ? null : test.message,
  };

  const connection = await prisma.nuboxConnection.upsert({
    where: { organizationId: session.organizationId },
    update: data,
    create: { organizationId: session.organizationId, ...data },
  });

  return NextResponse.json(toPublicShape(connection));
}
