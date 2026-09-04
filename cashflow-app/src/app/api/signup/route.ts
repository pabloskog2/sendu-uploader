import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { organizationName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const organization = await prisma.organization.create({
    data: {
      name: organizationName,
      cashBalance: 0,
      cashBalanceDate: new Date(),
      memberships: {
        create: {
          role: "OWNER",
          user: {
            create: {
              email: email.toLowerCase().trim(),
              name,
              passwordHash,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, organizationId: organization.id });
}
