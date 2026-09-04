# Sendu · Flujo de Caja

Aplicación de proyección de flujo de caja pensada para Sendu y para venderse
como producto a otras empresas (multi-tenant: cada empresa tiene sus propios
usuarios y datos).

## Qué hace

1. **Se conecta a Nubox** (el facturador de Sendu) para traer las facturas de
   venta (ingresos) y de compra (egresos), con su fecha de vencimiento y
   estado.
2. **Pagos recurrentes**: gastos fijos no facturables (Previred, remuneraciones,
   créditos bancarios, arriendos, seguros, etc.) o ingresos recurrentes,
   configurables por frecuencia (semanal, quincenal, mensual, anual).
3. **Pagos únicos**: proyectos o pagos puntuales que no se repiten.
4. **Ventas estimadas**: proyección comercial de ingresos futuros aún no
   facturados, por mes.
5. **Flujo de caja proyectado**: combina todo lo anterior día a día, desde el
   saldo de caja actual, para al menos 90 días hacia adelante (30/60/90/120
   seleccionables), mostrando gráfico, saldo mínimo proyectado y desglose
   semanal.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM (SQLite en desarrollo; cambiar el `datasource` a `postgresql`
  para producción)
- NextAuth (credenciales) para login multi-empresa
- Recharts para el gráfico de flujo de caja

## Cómo correrlo localmente

```bash
cd cashflow-app
cp .env.example .env
npm install
npm run db:push     # crea las tablas en SQLite
npm run db:seed     # crea una empresa y usuario demo
npm run dev
```

Abre http://localhost:3000 e ingresa con `demo@sendu.cl` / `demo1234`, o crea
una empresa nueva desde `/signup`.

Por defecto `NUBOX_MODE=mock` en `.env.example`, así que en Configuración
puedes "conectar" con cualquier API Key/ID de empresa y el botón
"Sincronizar con Nubox" generará facturas de ejemplo para poder ver el flujo
de caja funcionando sin credenciales reales.

## Integración real con Nubox — próximo paso

El adapter vive en un solo archivo: `src/lib/nubox-client.ts`.

- `NuboxApiClient` tiene la estructura de las llamadas (autenticación,
  endpoints de documentos de venta/compra, mapeo de campos), pero los
  endpoints exactos y el esquema de autenticación están marcados con `TODO`
  porque deben confirmarse contra la documentación oficial de la API de
  Nubox y credenciales reales de la cuenta.
- Cuando tengas la documentación/credenciales: ajusta las rutas en
  `fetchDocuments()` y el mapeo de campos en `mapNuboxDocument()`, luego pon
  `NUBOX_MODE=live` en el `.env`. El resto de la app (sincronización, base de
  datos, UI) no requiere cambios porque todos consumen el tipo normalizado
  `NormalizedInvoice`.
- Las credenciales (API key/secret, ID de empresa) se guardan por empresa en
  Configuración → Conexión con Nubox, y se prueban con "Guardar y probar
  conexión" antes de sincronizar.

## Modelo de datos (multi-empresa)

- `Organization`: una empresa cliente de Sendu (o Sendu misma). Tiene su
  saldo de caja actual (`cashBalance` / `cashBalanceDate`) como punto de
  partida de la proyección.
- `User` + `Membership`: permite que un usuario pertenezca a una o más
  empresas, y que cada empresa venda el producto de forma independiente.
- `Invoice`: facturas normalizadas (de Nubox u otra fuente futura).
- `RecurringPayment`, `OneTimePayment`, `EstimatedSale`: las tres fuentes de
  proyección manual.
- `NuboxConnection`, `NuboxSyncLog`: credenciales y auditoría de
  sincronización por empresa.

## Motor de flujo de caja

`src/lib/cashflow-engine.ts` arma la proyección diaria:

- Facturas pendientes/vencidas: se ubican en su fecha de vencimiento; si ya
  venció y sigue impaga, se "arrastra" al primer día de la proyección.
- Pagos recurrentes: se expanden a ocurrencias concretas según su
  frecuencia dentro del rango pedido.
- Pagos únicos: se ubican en su fecha exacta.
- Ventas estimadas: se reparten en partes iguales entre los días del mes
  proyectado.
- El saldo corriente parte del saldo de caja configurado en Configuración y
  se acumula día a día, reportando además el saldo mínimo proyectado (para
  alertar de posibles déficits).

## Pendiente / siguientes pasos sugeridos

- Reemplazar el datasource de Prisma por `postgresql` y desplegar en un
  proveedor administrado para producción real multi-cliente.
- Conectar `NuboxApiClient` a los endpoints reales de Nubox (ver sección de
  integración arriba).
- Agregar roles más granulares (hoy todo usuario nuevo es `OWNER` de su
  empresa) si se necesita separar Admin/Solo lectura.
- Encriptar `apiKey`/`apiSecret` de Nubox en reposo (hoy se guardan en texto
  plano en la base de datos; para producción usar un secreto de aplicación
  para cifrar/descifrar antes de persistir).
- **Antes de desplegar a producción**, actualizar Next.js a la versión 16
  (`npm audit` reporta varias vulnerabilidades altas en la serie 14.x/15.x
  sin parche disponible salvo saltando a 16.3.4+). Se dejó en 14.2.35 en
  este MVP para evitar el riesgo de una migración mayor (App Router/React 19)
  sin poder probarla en un entorno real; no se recomienda exponer esta
  versión a internet sin antes hacer esa migración.
