# 🚀 DEPLOY WMS - PASOS INMEDIATOS

## Estado Actual

✅ **Código WMS Completo:** 26 archivos nuevos listos
✅ **Build Funciona:** 380KB optimizado
✅ **Git Conectado:** github.com/dazapata7/dunamixfy-scanner
⚠️ **Archivos sin commitear:** Todo el WMS está en local

---

## 📋 PASOS PARA DEPLOY (30 min)

### PASO 1: Ejecutar Migraciones en Supabase (10 min) ⚠️ CRÍTICO

**Ve a:** https://supabase.com/dashboard/project/aejbpjvufpyxlvitlvfn/sql

#### 1.1 Verificar Estado Actual
Ejecuta en SQL Editor:

```sql
-- ¿Ya existen las tablas WMS?
SELECT COUNT(*) as tablas_wms
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'warehouses',
    'products',
    'inventory_movements',
    'receipts',
    'dispatches',
    'shipment_records'
  );
```

**Si resultado = 0:** Ejecutar migración 005 (ver 1.2)
**Si resultado = 6:** Ya están creadas, ir a 1.3

#### 1.2 Migración 005 - Schema WMS (si no existe)
Copiar y ejecutar TODO el contenido de:
`supabase/migrations/005_wms_schema.sql`

✅ Esperar mensaje: "Success. No rows returned"

#### 1.3 Migración 006 - Trazabilidad
Verificar:
```sql
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_name = 'dispatches'
  AND column_name = 'first_scanned_at';
```

**Si resultado = 0:** Ejecutar `supabase/migrations/006_add_first_scan_tracking.sql`

#### 1.4 Migración 007 - Fotos
Verificar:
```sql
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name = 'photo_url';
```

**Si resultado = 0:** Ejecutar `supabase/migrations/007_add_product_photo.sql`

#### 1.5 Desactivar RLS (Row Level Security) - CRÍTICO
```sql
-- Sin esto, la app NO podrá acceder a las tablas
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_errors DISABLE ROW LEVEL SECURITY;
```

✅ Esperar mensaje: "Success. No rows returned" (11 veces)

---

### PASO 2: Crear Datos Iniciales (3 min)

#### 2.1 Crear Bodega Principal
```sql
INSERT INTO warehouses (code, name, address, is_active)
VALUES ('BOG-001', 'Bodega Principal', 'Bogotá, Colombia', true)
RETURNING id, code, name;
```

✅ Debe retornar 1 fila con el ID de la bodega

#### 2.2 Crear Productos de Prueba (Opcional)
```sql
INSERT INTO products (sku, name, barcode, is_active)
VALUES
  ('PROD-001', 'Producto Demo 1', '1234567890123', true),
  ('PROD-002', 'Producto Demo 2', '1234567890124', true),
  ('PROD-003', 'Producto Demo 3', '1234567890125', true)
RETURNING id, sku, name;
```

✅ Debe retornar 3 filas

---

### PASO 3: Commit y Push a GitHub (5 min)

Ejecutar en terminal:

```bash
# Ver archivos nuevos
git status

# Agregar TODO el WMS
git add .

# Commit con mensaje descriptivo
git commit -m "feat: WMS Fase 1 - Sistema completo de gestión de almacén

- Agregadas 26 archivos nuevos (componentes, servicios, hooks)
- Migraciones SQL 005, 006, 007 (schema, trazabilidad, fotos)
- CRUD bodegas y productos
- Entradas, salidas, ajustes de inventario
- Importación CSV/Excel Interrápidisimo
- Integración API Coordinadora
- Dashboard de despachos por tienda
- Historial con trazabilidad completa
- Validación de stock y prevención de duplicados
- ~380KB bundle optimizado con code-splitting"

# Push a GitHub
git push origin main
```

⏳ Espera 2-5 minutos mientras se hace el deploy automático

---

### PASO 4: Verificar Deploy (5 min)

#### 4.1 Encontrar URL de Producción

Si usas **Vercel:**
- Ve a: https://vercel.com/dashboard
- Busca proyecto "dunamixfy-scanner"
- Click en "Visit" para ver URL en vivo

Si usas **Netlify:**
- Ve a: https://app.netlify.com/
- Busca sitio "dunamixfy-scanner"
- URL estará en la parte superior

Si usas **GitHub Pages:**
- URL será: https://dazapata7.github.io/dunamixfy-scanner/

#### 4.2 Probar Funcionalidad Básica

1. ✅ Abrir URL de producción
2. ✅ Login funciona
3. ✅ Click en "WMS - Almacén" (botón naranja)
4. ✅ Selector de almacén muestra "Bodega Principal"
5. ✅ Home WMS muestra 7 cards
6. ✅ Click en "Inventario" → Muestra productos con stock 0
7. ✅ No hay errores en consola (F12)

---

### PASO 5: Testing Rápido en Producción (7 min)

#### Test 1: Crear Entrada de Inventario
1. WMS Home → "Entrada"
2. Agregar producto "PROD-001" con cantidad 10
3. Confirmar
4. ✅ Verificar en "Inventario" que muestra 10 unidades

#### Test 2: Importar CSV Interrápidisimo
1. WMS Home → "Importar CSV"
2. Subir archivo `reference/interrapidisimo-sample.xlsx`
3. ✅ Verificar que dice "989 envíos importados"

#### Test 3: Dashboard
1. WMS Home → "Dashboard"
2. ✅ Debe mostrar "0 despachos confirmados hoy" (aún no has escaneado)

---

## ⚠️ PROBLEMAS COMUNES

### Error: "relation 'warehouses' does not exist"
**Causa:** No ejecutaste migración 005
**Solución:** Volver a PASO 1.2

### Error: "RLS policy violation"
**Causa:** No desactivaste RLS
**Solución:** Volver a PASO 1.5

### Error: "Failed to fetch"
**Causa:** Variables de entorno no están en plataforma de deploy
**Solución:**
- **Vercel:** Settings → Environment Variables → Agregar:
  - `VITE_SUPABASE_URL` = `https://aejbpjvufpyxlvitlvfn.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = (tu key del .env)
- **Netlify:** Site settings → Build & deploy → Environment → Agregar las mismas

### Error: Build falla en deploy
**Causa:** Falta dependencia `xlsx`
**Solución:** Ya está en package.json, debería instalar automáticamente

---

## 🎯 CHECKLIST FINAL

Antes de dar por terminado:

- [ ] Migraciones 005, 006, 007 ejecutadas en Supabase
- [ ] RLS desactivado en todas las tablas WMS
- [ ] Bodega "BOG-001" creada
- [ ] Productos de prueba creados (opcional)
- [ ] Git commit hecho
- [ ] Git push hecho
- [ ] Deploy automático completado (2-5 min)
- [ ] URL producción accesible
- [ ] Login funciona
- [ ] WMS accesible desde dashboard
- [ ] No hay errores en consola
- [ ] Inventario se muestra correctamente
- [ ] Importación CSV funciona

---

## 🚀 SIGUIENTE PASO DESPUÉS DE DEPLOY

Una vez que todo esté en producción:

1. **Importar pedidos reales de Interrápidisimo:**
   - Descargar Excel del día desde Dunamix
   - WMS → Importar CSV → Subir archivo
   - Verificar que se importan correctamente

2. **Cargar inventario inicial:**
   - WMS → Entrada
   - Agregar productos reales con sus cantidades
   - Confirmar

3. **Empezar a escanear:**
   - WMS → Escanear Guía
   - Escanear código de guía
   - Verificar que descuenta stock
   - Ver en Dashboard por tienda

---

**Tiempo estimado total:** 30-40 minutos
**Dificultad:** Media (principalmente SQL en Supabase)

**¿LISTO PARA EMPEZAR?**
Comienza con PASO 1 (Migraciones en Supabase)
