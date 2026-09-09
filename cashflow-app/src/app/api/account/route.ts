import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { accountUpdateSchema } from "@/lib/validation";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { name: true, email: true },
  });
  return NextResponse.json({ ...user, role: session.role });
}

export async function PATCH(req: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = accountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: { name?: string; email?: string; passwordHash?: string } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.email) {
    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== session.userId) {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });
    }
    data.email = email;
  }
  if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { name: true, email: true },
  });
  return NextResponse.json(user);
}
