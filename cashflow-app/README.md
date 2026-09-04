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

### Fecha de vencimiento y forma de pago en compras (SII)

Confirmado revisando el detalle real del Registro de Compras y Venta: el
SII **nunca** informa fecha de vencimiento ni si una compra es al contado
o a crédito para ningún documento — no es un dato que falte a veces, es
que no es información tributaria, sino un acuerdo comercial privado con
cada proveedor.

Por eso ese dato se resuelve en la app, no en `sii-client.ts` (que solo
normaliza lo que el SII sí entrega): `src/lib/purchase-terms.ts` calcula
el vencimiento sumando un plazo de pago a la fecha de emisión, usando —
en este orden — el plazo configurado para ese proveedor en **Proveedores**
(`Supplier.paymentTermDays`), o si no está configurado, el plazo por
defecto de la empresa (`Organization.defaultPurchaseTermDays`,
Configuración). Un plazo de **0 días se interpreta como contado**: la
factura se marca pagada de inmediato (con `paidDate` = fecha de emisión) y
por lo tanto no se proyecta como egreso futuro en el flujo de caja —
exactamente el caso que había que evitar.

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

## Integración con el SII — decisión tomada: Clave Tributaria

Se decidió avanzar con Clave Tributaria (RUT + contraseña del portal
sii.cl) en vez de certificado digital, priorizando el onboarding
self-service para vender a muchas empresas. `src/lib/sii-client.ts` deja la
interfaz (`SiiClient.fetchPurchaseInvoices`) y un cliente mock, pero **la
implementación real (`SiiRcvClient`) sigue sin hacer**: a diferencia de
Nubox/Duemint, el SII no tiene una API REST pública para terceros — lo que
existe es automatizar la sesión del portal (login + navegar el Registro de
Compras y Venta), no un cliente de API convencional.

Con una captura HAR real ya se confirmaron dos endpoints (documentados en
detalle en `sii-client.ts`): `aaSessionService/load` (valida la sesión) y
`consdcvinternetui/services/data/facadeService/getResumen` (trae el RCV,
pero **agregado por tipo de documento y mes** — no factura por factura).
Sigue faltando: el POST de login real contra `zeusr.sii.cl` (la captura
empezó con la sesión ya iniciada) y el endpoint de detalle por documento
individual (folio, fecha, contraparte). Sin esos dos no se puede armar el
cliente real — mejor eso que adivinar endpoints de login/autenticación.

### Riesgos de usar la Clave Tributaria (y por qué "solo son GET" no los reduce)

Es una idea razonable pensar que como el cliente solo hace lecturas
(`GET`) filtradas por fecha, el riesgo es bajo — pero el riesgo real no
está en qué verbo HTTP usa nuestro código una vez adentro, sino en dos
cosas distintas:

1. **Qué es lo que se guarda.** La Clave Tributaria no es una API key de
   solo lectura — es la contraseña completa del portal tributario de la
   empresa. Con ella se puede hacer mucho más que ver facturas: declarar,
   ceder documentos a factoring, ver toda la situación tributaria. Si la
   base de datos de Sendu se filtra (o alguien con acceso interno hace mal
   uso), el radio de daño no depende de que nuestro propio cliente solo
   lea — depende de lo que esa contraseña permite hacer en manos de quien
   sea que la obtenga. **Mitigación implementada**: se guarda cifrada
   (AES-256-GCM, `src/lib/crypto.ts`) y nunca se devuelve por la API a un
   navegador, ni siquiera cifrada (`src/app/api/sii/connection/route.ts`).
   Falta: nunca loguear el valor en texto plano en ninguna parte (logs de
   errores, Sentry, etc.) — revisar esto al implementar `SiiRcvClient`.

2. **Qué es lo que se automatiza.** El paso sensible no es "consultar
   facturas" — es **el login automatizado en sí**, repetido para muchas
   empresas, probablemente desde un rango de IPs fijo de infraestructura
   de Sendu. Eso es exactamente el patrón que los sistemas anti-fraude de
   un portal bancario/tributario están diseñados para detectar, sin
   importar que después de loguearse solo se haga una lectura filtrada:
   - Puede activar bloqueos temporales o solicitar verificación adicional
     en la cuenta del **cliente real**, afectándolo a él, no solo a Sendu.
   - Un bug que reintente logins fallidos automáticamente podría agotar
     intentos y bloquear la cuenta — por eso `SiiRcvClient.login()` debe
     hacer **un solo intento por sync, nunca reintentar automáticamente**
     una falla de autenticación.
   - No hay contrato ni SLA: el SII puede cambiar su sitio sin aviso y
     romper la integración silenciosamente (el sync fallaría, pero vale la
     pena alertar explícitamente en vez de solo loguearlo, para no mostrar
     "conectado" con datos en verdad desactualizados).
   - No existe una versión "de solo lectura" o con permisos acotados de la
     Clave Tributaria (a diferencia de, por ejemplo, un token OAuth de
     alcance limitado) — es todo o nada.
   - Usar el portal de esta forma no es un canal que el SII sancione para
     terceros; conviene tratarlo como una automatización tolerada mientras
     funcione, no como una integración con garantías, y tener ya pensado un
     plan B (o una vía oficial, como certificado digital, si el SII llega
     a exigirlo o bloquearlo más adelante).

3. **Consentimiento**: como esto excede lo que un proveedor de software
   normalmente necesita (una contraseña completa, no un scope acotado),
   cada empresa cliente debería dar un consentimiento explícito y
   documentado de que autoriza a Sendu a usar su Clave Tributaria de esta
   forma — no asumir que "instalar la app" ya cubre esto.

**Plan operativo mínimo antes de activar `SII_MODE=live` con credenciales
reales:**
- Un solo intento de login por sync; sin reintentos automáticos.
- Espaciar las sincronizaciones entre empresas (no todas al mismo tiempo)
  para no parecer tráfico en ráfaga desde una misma IP.
- Alertar (no solo loguear) si el sync empieza a fallar de forma amplia —
  probable señal de que el SII cambió algo, no un caso puntual.
- Checkbox/registro explícito de consentimiento del cliente antes de pedir
  su Clave Tributaria.
- Nunca imprimir la Clave Tributaria en logs, mensajes de error o
  respuestas de API.

## Modelo de datos (multi-empresa)

- `Organization`: una empresa cliente de Sendu (o Sendu misma). Tiene su
  saldo de caja actual (`cashBalance` / `cashBalanceDate`) y el plazo de
  pago por defecto (`defaultPurchaseTermDays`) como puntos de partida de la
  proyección.
- `User` + `Membership`: permite que un usuario pertenezca a una o más
  empresas, y que cada empresa venda el producto de forma independiente.
- `Invoice`: facturas normalizadas, con `source` = `SII` | `DUEMINT` | `MANUAL`.
- `Supplier`: proveedores con su plazo de pago real (`paymentTermDays`;
  `null` = usar el de la organización, `0` = contado). Ver la sección de
  vencimiento de compras arriba.
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

- Implementar `SiiRcvClient` con datos reales del flujo de login/RCV (ver
  TODOs en `src/lib/sii-client.ts`: falta una captura HAR o acceso de red
  a sii.cl para hacerlo sin adivinar) y aplicar el plan operativo de la
  sección de riesgos (un solo intento de login, alertas, consentimiento).
- Confirmar el param de paginación de Duemint y el listado completo de
  códigos de `status` con su documentación.
- Reemplazar el datasource de Prisma por `postgresql` y desplegar en un
  proveedor administrado para producción real multi-cliente.
- Agregar roles más granulares (hoy todo usuario nuevo es `OWNER` de su
  empresa) si se necesita separar Admin/Solo lectura.
- Rotar `APP_ENCRYPTION_KEY` requiere re-cifrar `SiiConnection.claveTributaria`
  y `DuemintConnection.apiToken` existentes (hoy no hay un script para eso;
  agregarlo antes de rotar la clave en un entorno con datos reales).
- **Antes de desplegar a producción**, actualizar Next.js a la versión 16
  (`npm audit` reporta varias vulnerabilidades altas en la serie 14.x/15.x
  sin parche disponible salvo saltando a 16.3.4+). Se dejó en 14.2.35 en
  este MVP para evitar el riesgo de una migración mayor (App Router/React 19)
  sin poder probarla en un entorno real; no se recomienda exponer esta
  versión a internet sin antes hacer esa migración.
