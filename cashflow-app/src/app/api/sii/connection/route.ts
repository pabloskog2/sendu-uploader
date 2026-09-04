import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { siiConnectionSchema } from "@/lib/validation";
import { getSiiClient } from "@/lib/sii-client";
import { encryptSecret } from "@/lib/crypto";

// Nunca devolver la Clave Tributaria al frontend, ni siquiera cifrada.
function toPublicShape(connection: {
  rut: string | null;
  status: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
} | null) {
  if (!connection) return null;
  const { rut, status, lastSyncedAt, lastError } = connection;
  return { rut, status, lastSyncedAt, lastError, hasClaveTributaria: !!rut };
}

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const connection = await prisma.siiConnection.findUnique({
    where: { organizationId: session.organizationId },
  });
  return NextResponse.json(toPublicShape(connection));
}

export async function PUT(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = siiConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Probar con el valor en texto plano antes de cifrar y guardar.
  const client = getSiiClient(parsed.data);
  const test = await client.testConnection();

  const data = {
    rut: parsed.data.rut,
    claveTributaria: encryptSecret(parsed.data.claveTributaria),
    status: test.ok ? "CONNECTED" : "ERROR",
    lastError: test.ok ? null : test.message,
  };

  const connection = await prisma.siiConnection.upsert({
    where: { organizationId: session.organizationId },
    update: data,
    create: { organizationId: session.organizationId, ...data },
  });

  return NextResponse.json(toPublicShape(connection));
}
