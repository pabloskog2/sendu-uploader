# Sendu · Flujo de Caja

Aplicación de proyección de flujo de caja pensada para Sendu y para venderse
como producto a otras empresas (multi-tenant: cada empresa tiene sus propios
usuarios y datos).

## Qué hace

1. **Compras y ventas** desde el **facturador** de cada empresa (piloto con
   **Nubox**) — ver "Fuentes de datos" más abajo para el porqué del pivote
   desde el SII.
2. **Plazos de pago**: cuando Nubox no trae fecha de vencimiento en un
   documento (frecuente en compras), se resuelve con un plazo configurable
   por RUT de la contraparte o, si no hay uno, un plazo genérico de la
   empresa — ver "Resolución de vencimiento" más abajo.
3. **Pagos recurrentes**: gastos fijos no facturables (Previred, remuneraciones,
   créditos bancarios, arriendos, seguros, etc.) o ingresos recurrentes,
   configurables por frecuencia (semanal, quincenal, mensual, anual).
4. **Pagos únicos**: proyectos o pagos puntuales que no se repiten.
5. **Ventas estimadas**: proyección comercial de ingresos futuros aún no
   facturados, por mes.
6. **Flujo de caja proyectado**: combina todo lo anterior día a día, desde el
   saldo de caja actual, para al menos 90 días hacia adelante (30/60/90/120
   seleccionables). Dos vistas: **Resumen** (gráfico, saldo mínimo proyectado
   y desglose semanal) y **Cartola** (tabla día a día con el detalle por
   fuente: CxC Duemint, CxC próximo mes, CxP Nubox, CxP manuales, saldo
   diario).

## Fuentes de datos: por qué el facturador (Nubox) y no el SII

La primera versión de esta app usaba el Registro de Compras y Venta del SII
(vía scraping con Playwright, autenticado con Clave Tributaria) para traer
las compras, precisamente para evitar depender de qué facturador use cada
empresa cliente. Se abandonó ese enfoque:

- **El SII no tiene API oficial para terceros.** Lo que había era la SPA
  interna del portal, autenticada por cookie de sesión — un scraping, no una
  integración con contrato. En la práctica dejó de traer datos de forma
  silenciosa (probablemente detección anti-bot del propio SII), sin ningún
  error explícito, confirmando el riesgo que ya se había documentado antes
  del pivote: sin SLA, el sitio puede cambiar o bloquear el patrón de
  acceso en cualquier momento.
- **El facturador (Nubox) ya tiene el documento completo en ambos sentidos**
  — compras recibidas y ventas emitidas, cada una con su fecha de
  vencimiento real — porque es el sistema donde la empresa emite y registra
  sus DTEs. A diferencia del SII, tiene API propia pensada para integrarse.
- La contrapartida: cada empresa cliente usa un facturador distinto (Nubox,
  Bsale, Defontana, Chipax, etc.), así que vender esto a otra empresa que no
  use Nubox requiere un conector nuevo por facturador. Se acepta ese costo a
  cambio de una integración con API real en vez de scraping frágil.
- **Duemint** queda con un rol acotado: como gestiona la cobranza de las
  facturas de venta, solo se usa para actualizar el **estado de pago**
  (pagada / pendiente / vencida) de facturas que ya existen (creadas desde
  Nubox), emparejándolas por folio. No crea facturas nuevas ni es necesario
  para que la app funcione.

## Resolución de vencimiento cuando Nubox no lo trae

"El facturador ya trae fecha de vencimiento real" no es 100% cierto: en
compras, ese dato es un acuerdo comercial con el proveedor, no un dato
tributario, así que el DTE puede no incluirlo — el mismo problema que
existía con el SII, solo que ahora es la excepción y no la regla. Cuando
`NuboxClient.fetchInvoices()` devuelve un documento con `dueDate: null`
(compra o venta), `src/lib/payment-terms.ts` lo resuelve en este orden:

1. La fecha de vencimiento del propio documento, si viene.
2. El plazo configurado para el RUT de la contraparte
   (`PaymentTerm`, página **Plazos de Pago**).
3. El plazo genérico de la empresa (`Organization.defaultPaymentTermDays`,
   Configuración — 30 días por defecto, editable).

Un plazo de **0 días se interpreta como contado**: la factura se marca
pagada de inmediato (`paidDate` = fecha de emisión) y no se proyecta como
egreso/ingreso futuro. Esta resolución corre en `/api/nubox/sync`, antes de
guardar el `Invoice`, así que el resto de la app (Facturas, flujo de caja)
siempre ve un `dueDate` ya resuelto.

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

Por defecto `NUBOX_MODE=mock` y `DUEMINT_MODE=mock` en `.env.example`, así que
en Configuración puedes "conectar" con cualquier credencial y los botones de
sincronización generan facturas de ejemplo, para ver el flujo de caja
funcionando sin credenciales reales.

## Integración con Nubox — pendiente de validar contra la API real

`src/lib/nubox-client.ts` (`NuboxApiClient`) es una implementación **sin
confirmar todavía**: no se cuenta con documentación ni credenciales de la
API de Nubox en este momento, así que los endpoints (`sales-documents`,
`purchase-documents`), el esquema de autenticación (`Bearer` + header
`companyId`) y la forma de paginación son un mejor esfuerzo razonable, no
una captura real — a diferencia de como se construyó la integración con
Duemint (validada contra una respuesta real).

Antes de activar `NUBOX_MODE=live`:
1. Conseguir documentación oficial de la API de Nubox, o un HAR real de su
   portal (Red del navegador → exportar/ver ventas y compras) — el mismo
   método que se usó para confirmar Duemint y, antes, el SII.
2. Ajustar `NUBOX_API_BASE_URL`, los paths de `nubox-client.ts` y
   `mapNuboxDocument()` a la forma real de la respuesta.
3. Confirmar los nombres de campo para fecha de vencimiento y estado de pago,
   y en qué casos reales viene `null` — eso decide qué tan seguido entra en
   juego la resolución por plazo de pago de `src/lib/payment-terms.ts` (ver
   sección arriba).

Mientras tanto, `NUBOX_MODE=mock` (default) permite construir y probar el
resto de la app (UI, sync, flujo de caja) con datos de ejemplo realistas:
ventas con vencimiento real y compras que en su mayoría no lo traen, para
ejercitar la resolución por plazo de pago igual que pasaría en producción.

## Integración con Duemint — ya implementada, con rol acotado a estado de pago

`src/lib/duemint-client.ts` (`DuemintApiClient`) llama a
`GET https://api.duemint.com/api/v1/collection-documents` con:

- Headers: `Authorization: Bearer <token>` + header `companyId`.
- Query params: `since` / `until` en formato `YYYY-MM-DD`.
- El estado (pagada/pendiente/vencida) se calcula a partir de `amountDue`,
  `paidAmount` y `dueDate` en vez de confiar en el código `status` numérico,
  porque no está completamente documentado.

`src/app/api/duemint/sync/route.ts` solo usa `status`/`paidDate` de cada
documento para actualizar (nunca crear) la factura de venta correspondiente,
buscándola por `folio` dentro de la misma empresa — el resto de los campos
que trae Duemint (montos, cliente, vencimiento) se ignoran, porque esos ya
vienen de Nubox.

Pendiente de confirmar: el nombre exacto del query param de paginación
(se asume `page`; el cliente corta solo si deja de recibir items nuevos,
así nunca hace loop infinito). Poner `DUEMINT_MODE=live` en `.env` una vez
confirmado.

## Modelo de datos (multi-empresa)

- `Organization`: una empresa cliente de Sendu (o Sendu misma). Tiene su
  saldo de caja actual (`cashBalance` / `cashBalanceDate`) y el plazo de
  pago genérico (`defaultPaymentTermDays`) como puntos de partida de la
  proyección.
- `User` + `Membership`: permite que un usuario pertenezca a una o más
  empresas, y que cada empresa venda el producto de forma independiente.
- `Invoice`: facturas normalizadas, con `source` = `NUBOX` | `MANUAL`.
- `PaymentTerm`: plazo de pago (días) por RUT de contraparte; `0` = contado.
  Tiene prioridad sobre `defaultPaymentTermDays` — ver "Resolución de
  vencimiento" arriba.
- `RecurringPayment`, `OneTimePayment`, `EstimatedSale`: las tres fuentes de
  proyección manual.
- `NuboxConnection`, `DuemintConnection`, `SyncLog`: credenciales y
  auditoría de sincronización por empresa y por fuente.

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

El Dashboard muestra esta proyección en dos vistas: **Resumen** (gráfico +
desglose semanal) y **Cartola** (la tabla día a día de `projection.days`
sin agrupar, con columnas CxC Duemint / CxC próximo mes / CxP Nubox / CxP
manuales / Saldo diario — mismo dato, desglosado por fuente en vez de por
semana).

## Pendiente / siguientes pasos sugeridos

- Conseguir documentación o acceso de prueba a la API de Nubox y validar
  `NuboxApiClient` contra datos reales — ver la sección de integración
  Nubox arriba.
- Confirmar el param de paginación de Duemint y el listado completo de
  códigos de `status` con su documentación.
- Diseñar el conector para el siguiente facturador (Bsale, Defontana,
  Chipax, etc.) reutilizando la misma interfaz `NuboxClient`/`getXClient()`,
  a medida que se sumen clientes que no usen Nubox.
- Reemplazar el datasource de Prisma por `postgresql` y desplegar en un
  proveedor administrado para producción real multi-cliente.
- Agregar roles más granulares (hoy todo usuario nuevo es `OWNER` de su
  empresa) si se necesita separar Admin/Solo lectura.
- Rotar `APP_ENCRYPTION_KEY` requiere re-cifrar `NuboxConnection.apiToken` y
  `DuemintConnection.apiToken` existentes (hoy no hay un script para eso;
  agregarlo antes de rotar la clave en un entorno con datos reales).
- **Antes de desplegar a producción**, actualizar Next.js a la versión 16
  (`npm audit` reporta varias vulnerabilidades altas en la serie 14.x/15.x
  sin parche disponible salvo saltando a 16.3.4+). Se dejó en 14.2.35 en
  este MVP para evitar el riesgo de una migración mayor (App Router/React 19)
  sin poder probarla en un entorno real; no se recomienda exponer esta
  versión a internet sin antes hacer esa migración.
