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
  frequency: z.enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "ANNUAL"]),
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
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  description: z.string().optional().nullable(),
  distributionType: z.enum(["SINGLE", "PRORATE", "MILESTONES"]).default("PRORATE"),
  date: z.coerce.date().optional().nullable(),
  periodMonth: z.coerce.date().optional().nullable(),
  milestones: z
    .array(z.object({ date: z.coerce.date(), amount: z.coerce.number().positive() }))
    .optional()
    .nullable(),
});

export const paymentTermSchema = z.object({
  rut: z.string().min(1, "El RUT es obligatorio"),
  name: z.string().optional().nullable(),
  days: z.coerce.number().int().min(0, "Los días deben ser 0 o más"),
  notes: z.string().optional().nullable(),
});

export const nuboxConnectionSchema = z.object({
  apiToken: z.string().min(1, "El token es obligatorio"),
  companyId: z.string().min(1, "El companyId es obligatorio"),
});

export const duemintConnectionSchema = z.object({
  apiToken: z.string().min(1, "El token es obligatorio"),
  companyId: z.string().min(1, "El companyId es obligatorio"),
});

export const orgSettingsSchema = z.object({
  name: z.string().min(1),
  tradeName: z.string().optional().nullable(),
  rut: z.string().optional().nullable(),
  cashBalance: z.coerce.number(),
  defaultPaymentTermDays: z.coerce.number().int().min(0).default(30),
});

export const signupSchema = z.object({
  organizationName: z.string().min(1, "El nombre de la empresa es obligatorio"),
  name: z.string().min(1, "Tu nombre es obligatorio"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const userCreateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const userRoleUpdateSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

export const accountUpdateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").optional(),
  email: z.string().email("Correo inválido").optional(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").optional(),
});

// DEMO: sin pasarela de pago real. Solo se validan datos no sensibles —
// nunca se recibe el número completo de la tarjeta ni el CVV.
export const paymentMethodSchema = z.object({
  brand: z.enum(["Visa", "Mastercard", "Tarjeta"]),
  last4: z.string().regex(/^\d{4}$/, "Deben ser los últimos 4 dígitos"),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(new Date().getFullYear()),
});
