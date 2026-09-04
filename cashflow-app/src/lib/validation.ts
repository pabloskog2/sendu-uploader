import { z } from "zod";

export const recurringPaymentSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  category: z.enum([
    "PREVIRED",
    "REMUNERACIONES",
    "CREDITO_BANCO",
    "ARRIENDO",
    "SEGUROS",
    "SOFTWARE",
    "OTRO",
  ]),
  type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "ANNUAL"]),
  dayOfMonth: z.coerce.number().int().min(1).max(28).optional().nullable(),
  weekday: z.coerce.number().int().min(0).max(6).optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  active: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export const oneTimePaymentSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  category: z.enum(["PROYECTO", "OTRO"]).default("PROYECTO"),
  type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  date: z.coerce.date(),
  notes: z.string().optional().nullable(),
});

export const estimatedSaleSchema = z.object({
  periodMonth: z.coerce.date(),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  description: z.string().optional().nullable(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const nuboxConnectionSchema = z.object({
  apiKey: z.string().min(1, "La API key es obligatoria"),
  apiSecret: z.string().optional().nullable(),
  companyId: z.string().min(1, "El ID de empresa en Nubox es obligatorio"),
});

export const orgSettingsSchema = z.object({
  name: z.string().min(1),
  rut: z.string().optional().nullable(),
  cashBalance: z.coerce.number(),
  cashBalanceDate: z.coerce.date(),
});

export const signupSchema = z.object({
  organizationName: z.string().min(1, "El nombre de la empresa es obligatorio"),
  name: z.string().min(1, "Tu nombre es obligatorio"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
