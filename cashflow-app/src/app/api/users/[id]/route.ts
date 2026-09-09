import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { userRoleUpdateSchema } from "@/lib/validation";

// `id` es el membershipId (no el userId): un usuario podría pertenecer a
// más de una empresa, así que el rol y la baja son siempre por membership.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "No tienes permiso para editar usuarios" }, { status: 403 });
  }

  const membership = await prisma.membership.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!membership) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = userRoleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (membership.role === "OWNER" && parsed.data.role !== "OWNER") {
    const owners = await prisma.membership.count({
      where: { organizationId: session.organizationId, role: "OWNER" },
    });
    if (owners <= 1) {
      return NextResponse.json({ error: "Debe quedar al menos un dueño en la empresa" }, { status: 400 });
    }
  }

  const updated = await prisma.membership.update({
    where: { id: params.id },
    data: { role: parsed.data.role },
  });
  return NextResponse.json({ membershipId: updated.id, role: updated.role });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "No tienes permiso para quitar usuarios" }, { status: 403 });
  }

  const membership = await prisma.membership.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
  });
  if (!membership) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (membership.userId === session.userId) {
    return NextResponse.json({ error: "No puedes quitarte a ti mismo" }, { status: 400 });
  }

  if (membership.role === "OWNER") {
    const owners = await prisma.membership.count({
      where: { organizationId: session.organizationId, role: "OWNER" },
    });
    if (owners <= 1) {
      return NextResponse.json({ error: "Debe quedar al menos un dueño en la empresa" }, { status: 400 });
    }
  }

  await prisma.membership.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
