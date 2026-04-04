# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

Requiere un archivo `.env` en la raíz (copiar de `.env.example`):
```
VITE_SUPABASE_URL=https://aejbpjvufpyxlvitlvfn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key del dashboard>
```

## Commands

```bash
npm run dev        # Dev server en https://localhost:5173 (HTTPS auto vía mkcert)
npm run build      # Build de producción en /dist
npm run preview    # Preview del build de producción
npm run lint       # ESLint con zero warnings
```

No hay tests automatizados en este proyecto.

## Contexto del negocio

**Dunamix** es un e-commerce COD (Cash on Delivery) con productos RODILLAX y LUMBRAX (geles para dolor). Mercados: Colombia y México. Operación vía call centers con closers. Esta app controla el escaneo y despacho de guías de envío de transportadoras.

## Architecture Overview

**React 18 + Vite PWA** con backend exclusivamente en Supabase (PostgreSQL + Auth + Realtime). Sin servidor propio — toda la lógica de negocio vive en el cliente o en funciones/RPC de Supabase.

### Auth & Multi-tenancy

- `src/hooks/useAuth.jsx` — `AuthProvider` wrappea toda la app. Expone `user` (Supabase Auth) y llama a `get_user_profile` RPC para obtener `role` y `company_id`.
- `src/store/useStore.js` — Zustand con `persist` en localStorage. Guarda `operator`, `role`, `companyId`, `companyName`, `selectedWarehouse`. Es la fuente de verdad en el cliente para sesión activa.
- Roles: `superadmin` > `admin` > `operator`. Las rutas `/admin/*` y `/superadmin` se montan condicionalmente según el rol en `App.jsx`.

### Routing (App.jsx)

El router tiene **dos modos**:
1. **Móvil** (`useDeviceType` detecta mobile): rutas simplificadas solo con WMS básico y scanner.
2. **Desktop/Tablet**: layout completo con `SidebarLayout` + `TopBar` y todas las rutas WMS.

Todos los componentes son `lazy()` para code-splitting. El bundle inicial se reduce de ~862KB a ~200-300KB.

### Capas de servicios

| Archivo | Responsabilidad |
|---|---|
| `src/services/supabase.js` | Cliente Supabase + `carriersService`, `operatorsService`, `codesService` |
| `src/services/wmsService.js` | CRUD completo de WMS: warehouses, products, inventory, receipts, dispatches |
| `src/services/returnsService.js` | Lógica de devoluciones (crear, listar, actualizar estado) |
| `src/services/companiesService.js` | CRUD de empresas (usado por superadmin) |
| `src/services/csvImportService.js` | Parseo e importación de guías desde archivos CSV/Excel |
| `src/services/shipmentResolverService.js` | Resolución de guías contra la API externa Dunamixfy |
| `src/services/dunamixfyApi.js` | Cliente HTTP para la API Dunamixfy (fuente de verdad para órdenes) |
| `src/services/dunamixfyService.js` | Capa de alto nivel sobre `dunamixfyApi.js` |
| `src/services/offlineQueue.js` | Cola de operaciones offline persistida en localStorage |
| `src/services/syncService.js` | Auto-sync cuando el dispositivo recupera conexión |
| `src/services/remoteScannerService.js` | Sesiones host/client para scanner remoto vía Supabase Realtime |

**Archivos duplicados (versiones v2):** Existen `supabase-v2.js`, `validators-v2.js`, `useRealtimeV2.js` y `useScannerV2.js`. Los archivos sin sufijo (`supabase.js`, `validators.js`, etc.) son los canónicos activos. Los `-v2` son experimentos/migraciones en progreso; no crear nuevos `-v2` sin reemplazar el original.

### Validación de códigos

`src/utils/validators.js` implementa validación **dinámica** basada en `validation_rules` JSON almacenado en la tabla `carriers` de Supabase. No hay reglas hardcoded — agregar una transportadora nueva es solo un `INSERT` en BD.

Patrones soportados en `validation_rules`: `ends_with_001`, `starts_with_24`, `min_length`, `max_length`, `length`, `digits_only`.

Cada carrier también tiene `extraction_config` que define cómo extraer el código del raw scan:
```json
{ "method": "slice", "start": -14, "end": -3 }
```

**Transportadoras activas:** Coordinadora e Interrápidisimo.

**Códigos de prueba:**
- Coordinadora: `70020222800020000356813890077001`
- Interrápidisimo: `240041585918`

**Agregar nueva transportadora sin tocar código:**
```sql
INSERT INTO carriers (name, code, display_name, validation_rules, extraction_config)
VALUES ('Servientrega', 'servientrega', 'Servientrega',
  '{"pattern": "starts_with_SER", "min_length": 10}'::jsonb,
  '{"method": "substring", "start": 0, "length": 12}'::jsonb);
```

### Scanner QR/Barcode

- `src/components/ZXingScanner.jsx` — usa `@zxing/library` como decoder principal (alta precisión).
- `html5-qrcode` es dependencia secundaria de respaldo.
- Requiere **HTTPS** para acceso a cámara. En dev, `vite-plugin-mkcert` genera certificados válidos automáticamente.

### WMS (Warehouse Management System)

Módulo principal en `src/components/wms/` (~26 componentes). Flujo principal:
1. `WarehouseSelector` — seleccionar bodega activa (persiste en Zustand)
2. `ScanGuide` — escaneo de guías con ZXing, valida contra transportadora activa
3. `BatchSummaryPage` — resumen del lote antes de confirmar despacho
4. `DispatchDashboard` — vista principal de operaciones

Funcionalidades adicionales: `ProductionOrders` (BOM + capacidad), `Returns` (devoluciones con QR manual), `CSVImporter` (importar guías desde Excel/CSV de transportadoras).

### Base de datos

38 migraciones en `supabase/migrations/` (numeradas 005–040). Las más importantes:
- `032` — empresas y roles (multi-tenant)
- `035` — BOM (Bill of Materials) completo
- `036` — órdenes de producción
- `037` — módulo de devoluciones
- `040` — RLS (Row Level Security) por company/warehouse

Para aplicar migraciones nuevas: ejecutar el SQL directamente en el **SQL Editor del dashboard de Supabase** (no hay Supabase CLI configurado localmente).
Dashboard Supabase: `https://supabase.com/dashboard/project/aejbpjvufpyxlvitlvfn`

### PWA / Offline

Workbox con estrategia `NetworkFirst`. Assets JS/CSS: caché 5 min. APIs de Supabase: caché 1 hora. Si hay cambios que no se reflejan en el browser, limpiar caché del Service Worker con `Cmd+Shift+Delete` en Chrome/Safari.
