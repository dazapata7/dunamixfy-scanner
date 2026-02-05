# MIGRACIÓN 008: Fix RLS Policies (DELETE y UPDATE)

## 🚨 PROBLEMA IDENTIFICADO

**Síntoma:** Los productos y almacenes dicen "eliminado" pero no se borran, y al editar dice "producto no encontrado"

**Causa raíz:** Las políticas RLS (Row Level Security) solo permiten SELECT e INSERT, pero **faltan políticas para DELETE y UPDATE**.

**Evidencia en logs:**
```
✅ Producto eliminado correctamente: Array(0)  ← Array vacío = no se eliminó nada
```

## 📋 QUÉ HACE ESTA MIGRACIÓN

Agrega las políticas RLS faltantes para todas las tablas WMS:

### Warehouses (Almacenes)
- ✅ UPDATE (editar)
- ✅ DELETE (eliminar)

### Products (Productos)
- ✅ UPDATE (editar)
- ✅ DELETE (eliminar)

### Otras tablas WMS
- `inventory_movements`: UPDATE
- `receipt_items`: UPDATE, DELETE
- `dispatch_items`: UPDATE, DELETE
- `shipment_records`: UPDATE, DELETE
- `shipment_items`: UPDATE, DELETE
- `csv_import_batches`: UPDATE

## 🔧 CÓMO EJECUTAR

### Opción 1: Supabase Dashboard (Recomendado)

1. Ir a [Supabase Dashboard](https://app.supabase.com)
2. Seleccionar tu proyecto
3. Ir a **SQL Editor** (ícono de base de datos en el menú izquierdo)
4. Copiar TODO el contenido de `supabase/migrations/008_fix_rls_policies_delete_update.sql`
5. Pegarlo en el editor
6. Click en **Run** (o `Ctrl + Enter`)
7. Verificar que aparezca: ✅ Success. No rows returned

### Opción 2: Supabase CLI (si tienes instalado)

```bash
supabase db push
```

## ✅ VERIFICACIÓN

Después de ejecutar la migración, corre este query en SQL Editor:

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('warehouses', 'products')
ORDER BY tablename, cmd;
```

**Deberías ver 4 políticas por tabla:**
- `Enable read access for all users` (SELECT)
- `Enable insert for all users` (INSERT)
- `Enable update for all users` (UPDATE)
- `Enable delete for all users` (DELETE)

## 🧪 TESTING POST-MIGRACIÓN

1. **Test Delete:**
   - Ir a `/wms/manage-products`
   - Intentar eliminar un producto SIN movimientos
   - Ahora debería eliminarse correctamente
   - Verificar que el contador baje (ej: de 5 a 4 productos)

2. **Test Update:**
   - Editar un producto
   - Cambiar nombre o SKU
   - Guardar
   - Verificar que se actualice en la lista

3. **Verificar logs:**
   - Abrir consola (F12)
   - Intentar eliminar
   - Ahora debería mostrar:
     ```
     ✅ Producto eliminado correctamente: [{ id: "...", sku: "...", ... }]
     ```
     (Array con 1 elemento, no vacío)

## 🔒 SEGURIDAD

**IMPORTANTE:** Estas políticas permiten acceso total (`USING (true)`).

Para mejorar seguridad en el futuro, considera:

```sql
-- Solo usuarios autenticados
USING (auth.uid() IS NOT NULL)

-- Solo administradores
USING (
  auth.uid() IN (
    SELECT id FROM operators WHERE role = 'admin'
  )
)
```

## 📊 ESTADO DE POLÍTICAS ANTES Y DESPUÉS

### ANTES (Solo SELECT e INSERT)
```
warehouses:
  ✅ SELECT
  ✅ INSERT
  ❌ UPDATE (faltaba)
  ❌ DELETE (faltaba)

products:
  ✅ SELECT
  ✅ INSERT
  ❌ UPDATE (faltaba)
  ❌ DELETE (faltaba)
```

### DESPUÉS (Completo)
```
warehouses:
  ✅ SELECT
  ✅ INSERT
  ✅ UPDATE
  ✅ DELETE

products:
  ✅ SELECT
  ✅ INSERT
  ✅ UPDATE
  ✅ DELETE
```

## ⚠️ NOTAS IMPORTANTES

1. **Esta migración NO afecta datos existentes**, solo agrega permisos
2. **Es seguro ejecutarla múltiples veces** (usa `CREATE POLICY` sin `IF NOT EXISTS`, pero no falla si ya existe)
3. **Todos los usuarios autenticados podrán eliminar/editar** - ajustar según necesidad
4. **No rompe funcionalidad existente**, solo habilita la que faltaba

## 🐛 SI FALLA LA MIGRACIÓN

Si ves un error como:
```
ERROR: policy "Enable update for all users" for table "warehouses" already exists
```

Significa que alguna política ya existe. Opciones:

**Opción A: Ignorar** (si ya existe, está bien)

**Opción B: Ejecutar solo las faltantes**

```sql
-- Verificar qué políticas existen
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'products';

-- Ejecutar solo las que falten
```

## ✅ RESULTADO ESPERADO

Después de esta migración:
- ✅ DELETE funciona correctamente (productos/almacenes se eliminan)
- ✅ UPDATE funciona correctamente (ediciones se guardan)
- ✅ Contador de productos disminuye al eliminar
- ✅ Array de respuesta no está vacío

---

**Última actualización:** 2026-02-05
**Versión:** WMS Fase 1 - Fix RLS Policies
**Prioridad:** 🔴 CRÍTICA (bloquea funcionalidad básica)
