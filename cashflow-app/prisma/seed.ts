import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@sendu.cl";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("La cuenta demo ya existe, no se vuelve a crear.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const org = await prisma.organization.create({
    data: {
      name: "Sendu Demo SpA",
      tradeName: "Sendu Demo",
      rut: "76.000.000-0",
      cashBalance: 4_500_000,
      memberships: {
        create: {
          role: "OWNER",
          user: { create: { email, name: "Usuario Demo", passwordHash } },
        },
      },
    },
  });

  const today = new Date();

  await prisma.recurringPayment.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Previred (leyes sociales)",
        category: "PREVIRED",
        type: "EXPENSE",
        amount: 1_200_000,
        frequency: "MONTHLY",
        dayOfMonth: 12,
        startDate: today,
      },
      {
        organizationId: org.id,
        name: "Remuneraciones equipo",
        category: "REMUNERACIONES",
        type: "EXPENSE",
        amount: 6_500_000,
        frequency: "MONTHLY",
        dayOfMonth: 5,
        startDate: today,
      },
      {
        organizationId: org.id,
        name: "Crédito banco BCI",
        category: "CREDITO_BANCO",
        type: "EXPENSE",
        amount: 850_000,
        frequency: "MONTHLY",
        dayOfMonth: 20,
        startDate: today,
      },
      {
        organizationId: org.id,
        name: "Arriendo oficina",
        category: "ARRIENDO",
        type: "EXPENSE",
        amount: 950_000,
        frequency: "MONTHLY",
        dayOfMonth: 1,
        startDate: today,
      },
    ],
  });

  await prisma.oneTimePayment.create({
    data: {
      organizationId: org.id,
      name: "Compra notebooks equipo dev",
      category: "PROYECTO",
      type: "EXPENSE",
      amount: 2_100_000,
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 25),
    },
  });

  for (let i = 0; i < 3; i++) {
    const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
    await prisma.estimatedSale.create({
      data: {
        organizationId: org.id,
        periodMonth: month,
        amount: 8_000_000 + i * 500_000,
        description: "Proyección comercial",
        confidence: i === 0 ? "HIGH" : "MEDIUM",
      },
    });
  }

  console.log("Seed completado. Ingresa con demo@sendu.cl / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
