# ✅ CHECKLIST PRODUCCIÓN WMS - Dunamix Scanner

## 🔍 VERIFICACIONES ANTES DE SUBIR

### 1. Base de Datos Supabase (CRÍTICO)

#### Paso 1: Verificar migraciones existentes
Ejecutar en **SQL Editor** de Supabase:

```sql
-- Verificar si existen las tablas WMS
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'warehouses',
    'products',
    'inventory_movements',
    'receipts',
    'dispatches',
    'shipment_records'
  )
ORDER BY table_name;
```

**Resultado esperado:** 6 tablas (si ya ejecutaste migración 005)
**Si no aparecen:** Ejecutar `supabase/migrations/005_wms_schema.sql`

#### Paso 2: Verificar trazabilidad
```sql
-- Verificar si existe first_scanned_at en dispatches
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'dispatches'
  AND column_name IN ('first_scanned_at', 'first_scanned_by');
```

**Resultado esperado:** 2 columnas (si ya ejecutaste migración 006)
**Si no aparecen:** Ejecutar `supabase/migrations/006_add_first_scan_tracking.sql`

#### Paso 3: Verificar campo photo_url
```sql
-- Verificar si existe photo_url en products
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name = 'photo_url';
```

**Resultado esperado:** 1 columna (si ya ejecutaste migración 007)
**Si no aparece:** Ejecutar `supabase/migrations/007_add_product_photo.sql`

#### Paso 4: Verificar vistas
```sql
-- Verificar vistas críticas
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('inventory_stock_view', 'dispatch_scan_history');
```

**Resultado esperado:** 2 vistas

---

### 2. Datos Iniciales Requeridos

#### Crear Almacén de Prueba
```sql
-- Solo si no existe ningún almacén
INSERT INTO warehouses (code, name, address, is_active)
VALUES
  ('BOG-001', 'Bodega Principal Bogotá', 'Calle 123 #45-67, Bogotá', true)
ON CONFLICT (code) DO NOTHING;
```

#### Crear Productos de Prueba (Opcional)
```sql
-- Productos básicos para testing
INSERT INTO products (sku, name, barcode, is_active)
VALUES
  ('RODILLAX-50ML', 'Rodillax Gel 50ml', '7891234567890', true),
  ('LUMBRAX-100ML', 'Lumbrax Crema 100ml', '7891234567891', true),
  ('DOLOR-GEL-75ML', 'Dolor Gel 75ml', '7891234567892', true)
ON CONFLICT (sku) DO NOTHING;
```

---

### 3. Permisos y Políticas RLS (Row Level Security)

#### Verificar políticas existentes
```sql
-- Ver políticas en tablas WMS
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN (
  'warehouses', 'products', 'inventory_movements',
  'receipts', 'dispatches', 'shipment_records'
)
ORDER BY tablename, policyname;
```

**⚠️ ADVERTENCIA:** Si NO hay políticas y RLS está activado, nadie podrá acceder a las tablas.

#### Desactivar RLS temporalmente (solo si es necesario para testing)
```sql
-- SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN FINAL
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items DISABLE ROW LEVEL SECURITY;
```

**NOTA:** En producción real, deberías crear políticas adecuadas en lugar de desactivar RLS.

---

### 4. Configuración Frontend

#### Verificar archivo .env
```bash
VITE_SUPABASE_URL=https://aejbpjvufpyxlvitlvfn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

✅ Variables correctamente configuradas

---

### 5. Testing Pre-Deploy

#### Test 1: Login
- [ ] Login con usuario existente funciona
- [ ] Redirige correctamente a /dashboard

#### Test 2: Navegación WMS
- [ ] Click en "WMS - Almacén" desde dashboard
- [ ] Se carga /wms correctamente
- [ ] Muestra almacén seleccionado (o redirige a selector)

#### Test 3: Selección de Almacén
- [ ] Lista almacenes desde BD
- [ ] Permite seleccionar almacén
- [ ] Guarda en store (Zustand)

#### Test 4: Inventario
- [ ] /wms/inventory carga correctamente
- [ ] Muestra productos con stock 0 (vacío inicial)

#### Test 5: Crear Entrada (Receipt)
- [ ] /wms/receipt permite crear entrada
- [ ] Agrega productos y cantidades
- [ ] Confirma y crea movimientos IN
- [ ] Inventario se actualiza

#### Test 6: Importar CSV Interrápidisimo
- [ ] /wms/import-csv acepta .xlsx
- [ ] Parsea Excel correctamente
- [ ] Guarda shipment_records con status READY

#### Test 7: Escanear Guía
- [ ] /wms/scan-guide detecta transportadora
- [ ] Coordinadora: consulta API Dunamixfy
- [ ] Interrápidisimo: lee de BD local
- [ ] Muestra preview antes de confirmar
- [ ] Confirma y crea dispatch + movimientos OUT

#### Test 8: Dashboard WMS
- [ ] /wms/dashboard muestra despachos del día
- [ ] Agrupa por tienda/dropshipper
- [ ] Muestra guías por tienda
- [ ] Calcula totales correctamente

#### Test 9: Historial
- [ ] /wms/history muestra escaneos con trazabilidad
- [ ] Muestra first_scanned_at y operador
- [ ] Filtra por fecha y estado

---

### 6. Build de Producción

```bash
# Instalar dependencias (si no están)
npm install

# Build optimizado
npm run build

# Probar build localmente
npm run preview
```

#### Verificar bundle size
```bash
# El build debe generar:
# - dist/index.html
# - dist/assets/*.js (código optimizado)
# - dist/assets/*.css (estilos)
```

**Bundle esperado:** ~500-800KB total (con code-splitting)

---

### 7. Deploy

#### Opción 1: Vercel (Recomendado)
```bash
# Si ya tienes Vercel CLI
vercel --prod

# Variables de entorno en Vercel Dashboard:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

#### Opción 2: Netlify
```bash
# Netlify CLI
netlify deploy --prod

# Variables en Netlify Dashboard
```

#### Opción 3: GitHub Pages
```bash
# Configurar vite.config.js con base: '/repo-name/'
# Luego push a gh-pages branch
```

---

### 8. Verificación Post-Deploy

- [ ] URL producción carga correctamente
- [ ] Login funciona
- [ ] WMS es accesible
- [ ] No hay errores en consola del browser
- [ ] Conexión a Supabase funciona
- [ ] Realtime funciona (si aplica)

---

### 9. Configuración Supabase Storage (Opcional)

Si quieres usar fotos de productos:

1. Ir a **Storage** en Supabase Dashboard
2. Crear bucket `product-photos` (público)
3. Ejecutar políticas de acceso:

```sql
-- Permitir lectura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

-- Permitir subida autenticada
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos' AND auth.role() = 'authenticated');
```

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### Error: "relation 'warehouses' does not exist"
**Causa:** Migración 005 no ejecutada
**Solución:** Ejecutar `005_wms_schema.sql` en SQL Editor

### Error: "column 'first_scanned_at' does not exist"
**Causa:** Migración 006 no ejecutada
**Solución:** Ejecutar `006_add_first_scan_tracking.sql`

### Error: "RLS policy violation"
**Causa:** RLS activado sin políticas configuradas
**Solución:** Desactivar RLS temporalmente (ver paso 3) o crear políticas

### Error: "Failed to fetch" al cargar datos
**Causa:** Variables .env incorrectas o Supabase caído
**Solución:** Verificar VITE_SUPABASE_URL y ANON_KEY

### Error: Import CSV no funciona
**Causa:** Librería xlsx no instalada
**Solución:** `npm install xlsx`

---

## 📝 NOTAS IMPORTANTES

1. **Backup de BD:** Antes de ejecutar migraciones en producción, hacer backup en Supabase Dashboard
2. **Testing en local:** Probar TODO el flujo localmente antes de deploy
3. **Monitoreo:** Revisar logs de Supabase para errores
4. **Performance:** Verificar que las queries no sean lentas (usar índices)
5. **Seguridad:** NO exponer service_role_key en frontend

---

## ✅ LISTA DE VERIFICACIÓN FINAL

- [ ] Migraciones 005, 006, 007 ejecutadas en Supabase
- [ ] Al menos 1 almacén creado
- [ ] Al menos 3-5 productos creados
- [ ] RLS configurado correctamente (o desactivado para testing)
- [ ] Build npm run build sin errores
- [ ] Testing completo en local (todos los flujos)
- [ ] Deploy exitoso
- [ ] Verificación post-deploy OK
- [ ] Variables de entorno configuradas en plataforma de deploy

---

**Última actualización:** 2026-02-05
**Versión WMS:** Fase 1 - MVP
