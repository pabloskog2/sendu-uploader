import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { duemintConnectionSchema } from "@/lib/validation";
import { getDuemintClient } from "@/lib/duemint-client";
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

  const connection = await prisma.duemintConnection.findUnique({
    where: { organizationId: session.organizationId },
  });
  return NextResponse.json(toPublicShape(connection));
}

export async function PUT(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = duemintConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Probar con el valor en texto plano antes de cifrar y guardar.
  const client = getDuemintClient(parsed.data);
  const test = await client.testConnection();

  const data = {
    companyId: parsed.data.companyId,
    apiToken: encryptSecret(parsed.data.apiToken),
    status: test.ok ? "CONNECTED" : "ERROR",
    lastError: test.ok ? null : test.message,
  };

  const connection = await prisma.duemintConnection.upsert({
    where: { organizationId: session.organizationId },
    update: data,
    create: { organizationId: session.organizationId, ...data },
  });

  return NextResponse.json(toPublicShape(connection));
}
