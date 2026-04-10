# Plan de Migración: Dunamix WMS → Next.js + TypeScript + Railway

## Contexto

La app actual es un SPA React 18 + Vite desplegada en Vercel, con toda la lógica en el cliente y Supabase como único backend. Problemas:
- **Seguridad**: API key de Dunamixfy hardcodeada en el bundle del cliente (`dunamixfyApi.js:6`)
- **Escalabilidad**: CSV imports, backfills y sync procesan todo en el browser
- **Mantenibilidad**: 26,000 LOC JavaScript sin tipos; `wmsService.js` tiene 1,955 líneas
- **Deployment**: Vercel limita worker processes y Redis

**Stack actual**: React 18, Vite, React Router v7, Zustand, Tailwind CSS 3.4, Supabase, Vercel
**Stack destino**: Next.js 14+ (App Router), TypeScript, Zustand, Tailwind CSS, Supabase, BullMQ + Redis, Railway

---

## Inventario del Codebase Actual

| Categoría | Cantidad | LOC |
|---|---|---|
| Componentes | 46 archivos | ~17,200 |
| Hooks | 10 archivos | ~2,230 |
| Servicios | 14 archivos | ~5,550 |
| Utils | 2 archivos | ~340 |
| Store | 1 archivo | ~107 |
| Rutas | 26 únicas | 2 layouts (mobile/desktop) |
| Migraciones DB | 38 SQL | - |
| **Total fuente** | **~73 archivos** | **~25,900** |

---

## Estructura del Proyecto Next.js

```
dunamixfy-wms/
├── app/
│   ├── layout.tsx                      # AuthProvider + Zustand + Toaster
│   ├── page.tsx                        # Redirect → /wms/dashboard
│   ├── login/page.tsx                  # LoginAuth (client)
│   ├── register-company/page.tsx
│   ├── profile/page.tsx
│   ├── admin/
│   │   ├── page.tsx                    # AdminDashboard
│   │   ├── bodegas/page.tsx
│   │   └── operadores/page.tsx
│   ├── superadmin/page.tsx
│   ├── wms/
│   │   ├── layout.tsx                  # Sidebar+TopBar (desktop) / MobileLayout
│   │   ├── dashboard/page.tsx          # Server fetch KPIs → <DashboardClient>
│   │   ├── select-warehouse/page.tsx
│   │   ├── scan-guide/page.tsx         # 'use client' (cámara)
│   │   ├── batch-summary/page.tsx
│   │   ├── inventory/page.tsx          # Server fetch → client search
│   │   ├── receipt/page.tsx
│   │   ├── adjustment/page.tsx
│   │   ├── import-csv/page.tsx         # Client form → BullMQ job
│   │   ├── history/page.tsx            # Server fetch → client table
│   │   ├── inventory-history/page.tsx
│   │   ├── scan-history/page.tsx
│   │   ├── manage-warehouses/page.tsx
│   │   ├── manage-products/page.tsx
│   │   ├── returns/page.tsx
│   │   ├── debug-guide/page.tsx
│   │   ├── remote-scanner/
│   │   │   ├── host/page.tsx           # 'use client' (Realtime)
│   │   │   └── client/[sessionCode]/page.tsx
│   │   └── production/
│   │       ├── page.tsx                # ProductionOrders
│   │       ├── [id]/page.tsx           # ProductionOrderDetail
│   │       ├── products/page.tsx       # ProductionProducts
│   │       └── categories/page.tsx
│   └── api/
│       ├── health/route.ts
│       ├── dunamixfy/
│       │   ├── order-info/route.ts     # Proxy con API key server-side
│       │   ├── mark-scanned/route.ts
│       │   └── mark-unscanned/route.ts
│       ├── sync/route.ts              # Batch offline scans
│       ├── csv-import/
│       │   ├── route.ts              # Upload → enqueue BullMQ
│       │   └── status/[jobId]/route.ts
│       └── backfill/route.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # createBrowserClient (@supabase/ssr)
│   │   ├── server.ts                  # createServerClient (cookies)
│   │   └── middleware.ts
│   ├── redis.ts                       # ioredis connection
│   ├── queue/
│   │   ├── connection.ts
│   │   ├── csv-import.queue.ts
│   │   ├── backfill.queue.ts
│   │   ├── sync.queue.ts
│   │   └── dunamixfy.queue.ts
│   ├── workers/
│   │   ├── index.ts                   # Worker entrypoint (Railway)
│   │   ├── csv-import.worker.ts       # 12-phase CSV pipeline
│   │   ├── backfill.worker.ts
│   │   ├── sync.worker.ts
│   │   └── dunamixfy.worker.ts
│   ├── validators.ts
│   └── types/
│       ├── database.ts                # supabase gen types
│       ├── wms.ts
│       ├── api.ts
│       └── queue.ts
├── services/                          # wmsService.js (1,955 LOC) se descompone en:
│   ├── warehouses.service.ts
│   ├── products.service.ts
│   ├── inventory.service.ts
│   ├── dispatches.service.ts
│   ├── receipts.service.ts
│   ├── carriers.service.ts
│   ├── companies.service.ts
│   ├── returns.service.ts
│   ├── shipment-resolver.service.ts
│   ├── remote-scanner.service.ts      # Client-only (Supabase Realtime)
│   ├── offline-queue.ts               # Client-only (localStorage)
│   └── sync.client.ts                 # Client trigger → /api/sync
├── components/
│   ├── ui/                            # ProgressBar, KpiCard, TypeBadge, etc.
│   ├── scanner/                       # ZXingScanner wrapper
│   ├── layout/                        # SidebarLayout, TopBar
│   └── providers/                     # AuthProvider, StoreProvider
├── hooks/
│   ├── use-auth.ts
│   ├── use-device-type.ts
│   ├── use-wms.ts                     # Dunamixfy calls → /api/dunamixfy/*
│   ├── use-scanner.ts
│   ├── use-scanner-cache.ts
│   ├── use-realtime.ts
│   └── use-inventory.ts
├── store/
│   └── use-store.ts                   # Zustand typed + codesCache fix
├── middleware.ts                      # Auth + role protection
├── next.config.js                     # output: 'standalone' + serwist
├── Dockerfile
└── railway.toml
```

---

## Clasificación Server vs Client

### Server Components (data fetch inicial)
Dashboard, Inventory, History, Manage Warehouses/Products, Production Orders/Detail, Categories, Scan History, Admin Dashboard

### Client Components obligatorios (browser APIs)
- **Cámara**: ScanGuide, ZXingScanner, RemoteScannerClient, Returns (scanner)
- **Realtime**: RemoteScannerHost/Client (Supabase broadcast)
- **FileReader**: CSVImporter (upload form)
- **localStorage**: OfflineQueue, Zustand persist
- **Audio/Vibration**: Scanner feedback
- **window**: useDeviceType, SidebarLayout, TopBar (navigation)

---

## Mapeo de Rutas: React Router → App Router

| Ruta actual | Componente | Archivo Next.js | RSC/Client |
|---|---|---|---|
| `/` (no auth) | LoginAuth | `app/login/page.tsx` | Client |
| `/` (mobile) | MobileWMS | `app/(mobile)/page.tsx` | Client |
| `/` (desktop) | redirect | `app/page.tsx` | Server |
| `/profile` | UserProfile | `app/profile/page.tsx` | Client |
| `/register-company` | RegisterCompany | `app/register-company/page.tsx` | Client |
| `/admin` | AdminDashboard | `app/admin/page.tsx` | Hybrid |
| `/admin/bodegas` | ManageBodegas | `app/admin/bodegas/page.tsx` | Client |
| `/admin/operadores` | ManageOperators | `app/admin/operadores/page.tsx` | Client |
| `/superadmin` | SuperAdminDashboard | `app/superadmin/page.tsx` | Hybrid |
| `/wms/dashboard` | DispatchDashboard | `app/wms/dashboard/page.tsx` | Hybrid |
| `/wms/select-warehouse` | WarehouseSelector | `app/wms/select-warehouse/page.tsx` | Client |
| `/wms/scan-guide` | ScanGuide | `app/wms/scan-guide/page.tsx` | Client |
| `/wms/batch-summary` | BatchSummaryPage | `app/wms/batch-summary/page.tsx` | Client |
| `/wms/inventory` | InventoryList | `app/wms/inventory/page.tsx` | Hybrid |
| `/wms/receipt` | ReceiptForm | `app/wms/receipt/page.tsx` | Client |
| `/wms/adjustment` | AdjustmentForm | `app/wms/adjustment/page.tsx` | Client |
| `/wms/import-csv` | CSVImporter | `app/wms/import-csv/page.tsx` | Client |
| `/wms/history` | DispatchHistory | `app/wms/history/page.tsx` | Hybrid |
| `/wms/inventory-history` | InventoryHistory | `app/wms/inventory-history/page.tsx` | Hybrid |
| `/wms/scan-history` | ScanHistory | `app/wms/scan-history/page.tsx` | Hybrid |
| `/wms/manage-warehouses` | WarehouseManagement | `app/wms/manage-warehouses/page.tsx` | Hybrid |
| `/wms/manage-products` | ProductManagement | `app/wms/manage-products/page.tsx` | Hybrid |
| `/wms/returns` | Returns | `app/wms/returns/page.tsx` | Client |
| `/wms/remote-scanner/host` | RemoteScannerHost | `app/wms/remote-scanner/host/page.tsx` | Client |
| `/wms/remote-scanner/client/:s` | RemoteScannerClient | `app/wms/remote-scanner/client/[sessionCode]/page.tsx` | Client |
| `/wms/production` | ProductionOrders | `app/wms/production/page.tsx` | Hybrid |
| `/wms/production/:id` | ProductionOrderDetail | `app/wms/production/[id]/page.tsx` | Hybrid |
| `/wms/production/products` | ProductionProducts | `app/wms/production/products/page.tsx` | Hybrid |
| `/wms/production/categories` | CategoryManagement | `app/wms/production/categories/page.tsx` | Hybrid |
| `/wms/debug-guide` | DebugGuide | `app/wms/debug-guide/page.tsx` | Client |

---

## Mapeo de Servicios

| Servicio actual | Destino | Estrategia |
|---|---|---|
| `supabase.js` (324 LOC) | `lib/supabase/client.ts` + `lib/supabase/server.ts` | Split: browser client (`@supabase/ssr`) + server client (cookies) |
| `dunamixfyApi.js` (132 LOC) | `lib/dunamixfy/api.ts` (server-only) + API routes | **SEGURIDAD**: API key → `process.env.DUNAMIXFY_API_KEY` |
| `dunamixfyService.js` (153 LOC) | `lib/dunamixfy/service.ts` + API routes | Server-only; mark scanned/unscanned via API routes |
| `wmsService.js` (1,955 LOC) | 6 servicios tipados en `services/` | Descomponer monolito en domain services |
| `csvImportService.js` (779 LOC) | `lib/workers/csv-import.worker.ts` | BullMQ worker; file upload via API route |
| `backfillService.js` (169 LOC) | `lib/workers/backfill.worker.ts` | BullMQ worker con rate limiting |
| `syncService.js` (266 LOC) | `app/api/sync/route.ts` + `services/sync.client.ts` | Server procesa batch; client envía payload |
| `offlineQueue.js` (176 LOC) | `services/offline-queue.ts` | Client-only (localStorage), solo agregar tipos |
| `shipmentResolverService.js` (465 LOC) | `services/shipment-resolver.service.ts` | Portar con tipos; Dunamixfy calls via API routes |
| `remoteScannerService.js` (301 LOC) | `services/remote-scanner.service.ts` | Client-only (Supabase Realtime) |
| `companiesService.js` (211 LOC) | `services/companies.service.ts` | Portar con tipos |
| `returnsService.js` (232 LOC) | `services/returns.service.ts` | Portar con tipos |
| `carriersService.js` (en supabase.js) | `services/carriers.service.ts` | Extraer de supabase.js |

---

## BullMQ Workers (Redis)

| Queue | Origen actual | Worker | Descripción |
|---|---|---|---|
| `csv-import` | `csvImportService.js` (779 LOC, 12 fases) | `csv-import.worker.ts` | Parse + bulk insert shipments. Progress via `job.updateProgress()` |
| `backfill` | `backfillService.js` (169 LOC) | `backfill.worker.ts` | Enrich codes vía Dunamixfy API con rate limiting (500ms delay) |
| `sync` | `syncService.js` (266 LOC) | `sync.worker.ts` | Process offline scan batch con retry logic |
| `dunamixfy` | `dunamixfyService.js` (153 LOC) | `dunamixfy.worker.ts` | Mark scanned/unscanned (fire-and-forget, 3 retries exponencial) |

---

## Variables de Entorno

| Actual (Vite) | Next.js | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` | Client + Server |
| `VITE_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server |
| *(no existe)* | `SUPABASE_SERVICE_ROLE_KEY` | Server only (workers bypasan RLS) |
| *(hardcoded en cliente!)* | `DUNAMIXFY_API_KEY` | Server only |
| *(no existe)* | `REDIS_URL` | Server only |

---

## Dependencias

### Mantener
`react`, `react-dom`, `zustand`, `@supabase/supabase-js`, `lucide-react`, `react-hot-toast`, `date-fns`, `qrcode.react`, `html5-qrcode`, `@zxing/library`, `tailwindcss`

### Mover a server-only
`papaparse`, `xlsx` — usados en BullMQ workers, no en bundle del cliente

### Agregar
`@supabase/ssr`, `bullmq`, `ioredis`, `zod`, `@serwist/next` (PWA), `@bull-board/api` + `@bull-board/next` (monitor opcinal)

### Eliminar
`react-router-dom`, `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `vite-plugin-mkcert`

---

## Fases de Migración

### Fase 0: Infraestructura (3-5 días)

**Tareas:**
1. Crear proyecto Next.js 14+ con TypeScript
2. Copiar configuración Tailwind (custom colors primary/#0afdbd, dark palette, fonts Manrope/Bai Jamjuree/Fira Code)
3. Copiar `App.css` → `app/globals.css`, `scanner-custom.css`, assets de `public/`
4. Crear proyecto Railway: web service (Docker) + Redis addon
5. Configurar env vars en Railway
6. `supabase gen types typescript` → `lib/types/database.ts`
7. Instalar todas las dependencias

**Checkpoint**: Dev server arranca, Tailwind renderiza con tema Dunamix, Redis conecta

### Fase 1: Foundation (5-7 días)

**Tareas:**
1. Supabase clients: browser (`@supabase/ssr`) + server (cookies)
2. `middleware.ts`: refresh session, redirect no-auth a `/login`, proteger `/admin/*` y `/superadmin`
3. `store/use-store.ts`: Zustand tipado + fix `codesCache` (Set → Record<string, true>)
4. Auth provider: portar `useAuth.jsx` con `@supabase/ssr` cookie flow + `onAuthStateChange`
5. Root layout: fonts + providers (Auth, Store, Toaster)
6. WMS layout: client component con `useDeviceType`, condicional Sidebar/Mobile
7. Login page + Sidebar + TopBar

**Checkpoint**: Login E2E, sidebar renderiza, Zustand persiste, rutas protegidas por rol

### Fase 2: API Routes + Server Components (7-10 días)

**Tareas:**
1. **API Routes Dunamixfy** (fix seguridad #1):
   - `order-info/route.ts`: proxy con API key server-side + Zod + timeout 5s
   - `mark-scanned/route.ts`, `mark-unscanned/route.ts`
2. **Descomponer `wmsService.js`** en 6 servicios tipados
3. **Portar servicios** restantes a TypeScript
4. **Server Components**: Dashboard, History, Inventory, Products, Warehouses, Production, Categories
5. **`/api/sync` route**: batch process offline scans

**Checkpoint**: API key NO en bundle cliente, dashboards cargan server-side, APIs responden

### Fase 3: Client Components (7-10 días)

**Tareas:**
1. Scanner: ZXingScanner, ScanGuide (cámara + batch + offline), BatchSummary
2. Remote Scanner: Host (Realtime + process) + Client (cámara + Realtime)
3. Forms: Receipt, Adjustment, Returns, Register Company
4. Admin: ManageBodegas, ManageOperators, SuperAdmin
5. CSV Importer: form client → upload API route → BullMQ → polling progreso
6. Hooks a TypeScript (Dunamixfy calls → `/api/dunamixfy/*`)
7. Offline queue + sync client trigger
8. Mobile layout condicional

**Checkpoint**: Cámara funciona en HTTPS, remote scanner conecta, CSV procesa en background, offline queue sincroniza

### Fase 4: BullMQ Workers (5-7 días)

**Tareas:**
1. Redis connection + queue definitions
2. Workers: csv-import (12 fases), backfill, sync, dunamixfy
3. Worker entrypoint para Railway
4. Bull Board (opcional)

**Checkpoint**: CSV upload → Redis job → worker procesa → status endpoint retorna progreso

### Fase 5: PWA + Deploy (3-5 días)

**Tareas:**
1. PWA con `@serwist/next` (NetworkFirst para assets 5min, Supabase API 1h)
2. Dockerfile multi-stage (builder + standalone)
3. Railway: web service + worker service + Redis
4. `next.config.js`: `output: 'standalone'`
5. Health check endpoint
6. Auditoría seguridad

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Checkpoint**: PWA instala, offline scanning funciona, Docker build en Railway OK, workers procesan, HTTPS + cámara OK

### Fase 6: Parallel Run + Cutover (2-3 días)

1. Correr Vercel y Railway en paralelo
2. Testing completo en Railway
3. DNS cutover
4. Monitorear 48h
5. Decomisionar Vercel

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|---|---|
| `@serwist/next` menos maduro que `vite-plugin-pwa` | Probar extensivamente; fallback a custom service worker |
| `import.meta.env` incompatible con Next.js | Reemplazar con `process.env.NEXT_PUBLIC_*` |
| `codesCache: new Set()` no serializa en Zustand persist | Cambiar a `Record<string, true>` |
| `useDeviceType` lee `window.innerWidth` en SSR | Guard `typeof window !== 'undefined'`; initial `false` |
| Camera sin HTTPS no funciona | Railway provee SSL automático |
| BullMQ workers necesitan proceso separado | Railway soporta múltiples services desde mismo Docker |
| Downtime en DNS switch | Parallel run; zero-downtime switch |

---

## Base de datos

**NO se modifica.** Se mantiene Supabase PostgreSQL con las 38 migraciones, tablas, RPCs, triggers y RLS policies. Solo se agrega:
- `SUPABASE_SERVICE_ROLE_KEY` para workers server-side que bypasean RLS
- Types generados vía `supabase gen types typescript`

---

## Auth: Estrategia de Migración

### Actual
`AuthProvider` → `supabase.auth.getSession()` + `onAuthStateChange()` client-side. Session en localStorage de Supabase.

### Nuevo
1. `@supabase/ssr` reemplaza `@supabase/supabase-js` para sesiones basadas en cookies
2. `middleware.ts` intercepta cada request: refresh session, redirect no-auth, proteger rutas por rol
3. Server-side Supabase client (`lib/supabase/server.ts`): creado per-request usando `cookies()` de `next/headers`
4. Client-side Supabase client (`lib/supabase/client.ts`): cookies para session
5. Mobile vs Desktop: `app/wms/layout.tsx` sigue siendo client component con `useDeviceType`

---

## Timeline Estimado

| Fase | Duración | Depende de |
|---|---|---|
| Fase 0: Infraestructura | 3-5 días | - |
| Fase 1: Foundation | 5-7 días | Fase 0 |
| Fase 2: API Routes + Server | 7-10 días | Fase 1 |
| Fase 3: Client Components | 7-10 días | Fase 2 |
| Fase 4: BullMQ Workers | 5-7 días | Fase 2 (paralelo con Fase 3) |
| Fase 5: PWA + Deploy | 3-5 días | Fase 3 + 4 |
| Fase 6: Cutover | 2-3 días | Fase 5 |
| **Total** | **32-47 días** | **(6-9 semanas)** |

> Fases 3 y 4 pueden ejecutarse en paralelo parcial ya que comparten las API routes de Fase 2 pero son independientes entre sí.

---

## Archivos Críticos para la Migración

| Archivo actual | LOC | Razón |
|---|---|---|
| `src/services/dunamixfyApi.js` | 132 | API key hardcodeada — fix de seguridad #1 |
| `src/services/wmsService.js` | 1,955 | Monolito a descomponer en ~6 servicios tipados |
| `src/services/csvImportService.js` | 779 | Pipeline de 12 fases → BullMQ worker |
| `src/App.jsx` | 237 | Routing completo → file-based App Router |
| `src/hooks/useAuth.jsx` | 221 | Auth flow → rewrite con `@supabase/ssr` + middleware |
| `src/components/wms/ScanGuide.jsx` | 1,015 | Componente más complejo (cámara + batch + offline) |
| `src/components/wms/RemoteScannerHost.jsx` | 834 | Realtime bidireccional |
| `src/store/useStore.js` | 107 | Zustand → TypeScript + fix serialización Set |
