import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { userCreateSchema } from "@/lib/validation";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const memberships = await prisma.membership.findMany({
    where: { organizationId: session.organizationId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "No tienes permiso para agregar usuarios" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      memberships: {
        create: { organizationId: session.organizationId, role: parsed.data.role },
      },
    },
  });

  return NextResponse.json({ userId: user.id, name: user.name, email: user.email, role: parsed.data.role }, { status: 201 });
}
