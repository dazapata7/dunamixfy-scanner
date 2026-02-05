# 🚀 EJECUTAR MIGRATION WMS EN SUPABASE

## Opción 1: SQL Editor (Recomendado para Fase 1)

### Pasos:

1. **Abrir Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/aejbpjvufpyxlvitlvfn
   ```

2. **Ir a SQL Editor:**
   - Click en "SQL Editor" en el menú lateral izquierdo
   - Click en "New Query"

3. **Copiar y Pegar el SQL:**
   - Abrir el archivo `005_wms_schema.sql`
   - Copiar TODO el contenido
   - Pegar en el SQL Editor

4. **Ejecutar:**
   - Click en "Run" (o Ctrl+Enter)
   - Esperar a que termine (puede tomar 10-30 segundos)

5. **Verificar:**
   - Ir a "Table Editor"
   - Deberías ver las nuevas tablas:
     - `warehouses`
     - `products`
     - `inventory_movements`
     - `receipts`
     - `receipt_items`
     - `dispatches`
     - `dispatch_items`
     - `shipment_records`
     - `shipment_items`
     - `csv_import_batches`
     - `csv_import_errors`

6. **Verificar datos de prueba:**
   - Click en tabla `warehouses` → deberías ver 2 filas (BOG-001, MED-001)
   - Click en tabla `products` → deberías ver 5 productos (RODILLAX, LUMBRAX)

---

## Opción 2: Supabase CLI (Para desarrollo avanzado)

### Requisitos:
```bash
# Instalar Supabase CLI
npm install -g supabase
```

### Pasos:

1. **Login a Supabase:**
   ```bash
   supabase login
   ```

2. **Link al proyecto:**
   ```bash
   supabase link --project-ref aejbpjvufpyxlvitlvfn
   ```

3. **Ejecutar migration:**
   ```bash
   supabase db push
   ```

---

## Verificación Post-Migration

### 1. Verificar tablas creadas
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'warehouses', 'products', 'inventory_movements',
    'receipts', 'receipt_items', 'dispatches', 'dispatch_items',
    'shipment_records', 'shipment_items',
    'csv_import_batches', 'csv_import_errors'
  );
```

### 2. Verificar vista
```sql
SELECT * FROM inventory_stock_view LIMIT 5;
```

### 3. Verificar funciones
```sql
SELECT generate_receipt_number();
SELECT generate_dispatch_number();
```

### 4. Verificar datos de prueba
```sql
-- Warehouses
SELECT * FROM warehouses;

-- Products
SELECT * FROM products;
```

---

## Troubleshooting

### Error: "function update_updated_at_column() does not exist"

**Solución:** Esta función debería estar creada en migrations anteriores. Si no existe, ejecuta:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Error: "relation operators does not exist"

**Solución:** La tabla `operators` debería existir de migrations anteriores. Verificar en Table Editor.

### Error: "relation carriers does not exist"

**Solución:** La tabla `carriers` debería existir de migrations anteriores. Verificar en Table Editor.

---

## Próximo Paso

Después de ejecutar exitosamente la migration:

1. ✅ Verificar tablas en Supabase Dashboard
2. ✅ Confirmar datos de prueba (2 warehouses, 5 products)
3. ➡️ Continuar con implementación de servicios (`wmsService.js`)

---

## Rollback (Si algo sale mal)

Si necesitas revertir la migration:

```sql
-- CUIDADO: Esto eliminará todas las tablas WMS
DROP TABLE IF EXISTS csv_import_errors CASCADE;
DROP TABLE IF EXISTS csv_import_batches CASCADE;
DROP TABLE IF EXISTS shipment_items CASCADE;
DROP TABLE IF EXISTS shipment_records CASCADE;
DROP TABLE IF EXISTS dispatch_items CASCADE;
DROP TABLE IF EXISTS dispatches CASCADE;
DROP TABLE IF EXISTS receipt_items CASCADE;
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;

DROP VIEW IF EXISTS inventory_stock_view;
DROP FUNCTION IF EXISTS generate_receipt_number();
DROP FUNCTION IF EXISTS generate_dispatch_number();
```
