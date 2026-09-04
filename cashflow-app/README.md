# Sendu · Flujo de Caja

Aplicación de proyección de flujo de caja pensada para Sendu y para venderse
como producto a otras empresas (multi-tenant: cada empresa tiene sus propios
usuarios y datos).

## Qué hace

1. **Egresos (compras)** desde el **SII** (Registro de Compras y Venta) y
   **ingresos (ventas) + estado real de pago** desde **Duemint** — ver
   "Fuentes de datos" más abajo para el porqué de usar dos fuentes distintas.
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

## Fuentes de datos: por qué SII + Duemint (no un solo facturador)

Conectar a un facturador específico (ej. Nubox) obligaría a hacer una
integración distinta por cada facturador que use cada empresa cliente. Para
un producto que se vende a muchas empresas, conviene una fuente genérica:

- **SII (compras/egresos)**: el SII es la fuente de verdad para cualquier
  empresa chilena, sin depender de qué facturador use. Pero **el SII no
  informa si un documento fue pagado**, solo su estado tributario (emitido,
  aceptado, reclamado).
- **Duemint (ventas/ingresos + pago)**: como Duemint gestiona la cobranza de
  las facturas que la empresa emite a sus clientes, su endpoint
  `collection-documents` entrega en un solo lugar fecha de vencimiento real
  y si ya se pagó (y cuándo) — justo lo que al SII le falta. Por eso las
  ventas se traen de Duemint en vez del SII.

Esto significa que hoy la app no cubre "ventas emitidas pero aún no
cargadas a Duemint" ni "compras con proveedores que no pasan por el SII" —
casos borde a tener en cuenta si se generaliza a otra empresa que no use
Duemint para cobranza.

### Fecha de vencimiento en el SII

El DTE (factura electrónica) tiene un campo opcional `FchVenc`, pero muchas
facturas "a crédito" no lo completan, y no está garantizado que venga
siempre. Cuando falta, `sii-client.ts` calcula un vencimiento estimado
sumando un plazo configurable (`defaultPurchaseTermDays`, editable en
Configuración) a la fecha de emisión.

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

Por defecto `SII_MODE=mock` y `DUEMINT_MODE=mock` en `.env.example`, así que
en Configuración puedes "conectar" con cualquier credencial y los botones de
sincronización generan facturas de ejemplo, para ver el flujo de caja
funcionando sin credenciales reales.

## Integración con Duemint — ya implementada, pendiente de confirmar detalles menores

`src/lib/duemint-client.ts` (`DuemintApiClient`) llama a
`GET https://api.duemint.com/api/v1/collection-documents` con:

- Headers: `Authorization: Bearer <token>` + header `companyId`.
- Query params: `since` / `until` en formato `YYYY-MM-DD`.
- El estado (pagada/pendiente/vencida) se calcula a partir de `amountDue`,
  `paidAmount` y `dueDate` en vez de confiar en el código `status` numérico,
  porque no está completamente documentado.

Pendiente de confirmar: el nombre exacto del query param de paginación
(se asume `page`; el cliente corta solo si deja de recibir items nuevos,
así nunca hace loop infinito). Poner `DUEMINT_MODE=live` en `.env` una vez
confirmado.

## Integración con el SII — pendiente de decisión y de implementar

`src/lib/sii-client.ts` deja la interfaz (`SiiClient.fetchPurchaseInvoices`)
y un cliente mock, pero **la implementación real (`SiiRcvClient`) está sin
hacer**. A diferencia de Nubox/Duemint, el SII no tiene una API REST pública
para terceros: lo que existe es automatizar la sesión del portal del SII
(login con RUT + Clave Tributaria, luego navegar el Registro de Compras y
Venta), no un cliente de API convencional. Antes de implementarlo:

- **Seguridad/legal**: esto implica guardar la Clave Tributaria de cada
  empresa cliente — la contraseña completa de su portal tributario, no solo
  lectura de facturas. Hay que cifrarla en reposo y probablemente pedir un
  mandato/consentimiento explícito del cliente.
- **Mecanismo de login**: el portal del SII puede requerir CAPTCHA o
  verificaciones, lo que podría obligar a un navegador headless en vez de
  un simple `fetch`.
- **Estabilidad**: al no ser una API oficial, un cambio en el sitio del SII
  puede romper la integración sin aviso.

Mientras esto no esté resuelto, `SiiConnection.claveTributaria` se guarda en
texto plano en la base de datos — **no usar con credenciales reales en
producción** hasta cifrar ese campo.

## Modelo de datos (multi-empresa)

- `Organization`: una empresa cliente de Sendu (o Sendu misma). Tiene su
  saldo de caja actual (`cashBalance` / `cashBalanceDate`) y el plazo de
  pago por defecto (`defaultPurchaseTermDays`) como puntos de partida de la
  proyección.
- `User` + `Membership`: permite que un usuario pertenezca a una o más
  empresas, y que cada empresa venda el producto de forma independiente.
- `Invoice`: facturas normalizadas, con `source` = `SII` | `DUEMINT` | `MANUAL`.
- `RecurringPayment`, `OneTimePayment`, `EstimatedSale`: las tres fuentes de
  proyección manual.
- `SiiConnection`, `DuemintConnection`, `SyncLog`: credenciales y auditoría
  de sincronización por empresa y por fuente.

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

- Implementar `SiiRcvClient` (ver sección de integración SII arriba) y
  decidir el enfoque definitivo (automatización de portal vs. certificado
  digital + servicio de facturación electrónica).
- Confirmar el param de paginación de Duemint y el listado completo de
  códigos de `status` con su documentación.
- Reemplazar el datasource de Prisma por `postgresql` y desplegar en un
  proveedor administrado para producción real multi-cliente.
- Agregar roles más granulares (hoy todo usuario nuevo es `OWNER` de su
  empresa) si se necesita separar Admin/Solo lectura.
- Encriptar en reposo `SiiConnection.claveTributaria` y
  `DuemintConnection.apiToken` (hoy se guardan en texto plano; usar un
  secreto de aplicación para cifrar/descifrar antes de persistir).
- **Antes de desplegar a producción**, actualizar Next.js a la versión 16
  (`npm audit` reporta varias vulnerabilidades altas en la serie 14.x/15.x
  sin parche disponible salvo saltando a 16.3.4+). Se dejó en 14.2.35 en
  este MVP para evitar el riesgo de una migración mayor (App Router/React 19)
  sin poder probarla en un entorno real; no se recomienda exponer esta
  versión a internet sin antes hacer esa migración.
