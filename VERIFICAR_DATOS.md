# Verificación de Datos de Dunamixfy

## Pasos para verificar en Supabase:

### 1. Abrir Supabase Table Editor
1. Ve a https://supabase.com
2. Abre tu proyecto
3. Ve a "Table Editor"
4. Selecciona la tabla `codes`

### 2. Verificar columnas
Busca las siguientes columnas en la tabla `codes`:
- ✅ `customer_name` (TEXT)
- ✅ `order_id` (TEXT)
- ✅ `store_name` (TEXT)
- ✅ `carrier_name` (TEXT)

### 3. Verificar datos
Revisa los registros más recientes y verifica si estas columnas tienen datos o están NULL:
- Si están **NULL** → La consulta a Dunamixfy NO se está ejecutando
- Si tienen **datos** → El problema es en el frontend (no se muestran correctamente)

## Si las columnas están NULL:

Ejecuta este query SQL en Supabase para verificar los últimos 5 códigos:

```sql
SELECT
  id,
  code,
  carrier_name,
  customer_name,
  order_id,
  store_name,
  created_at
FROM codes
ORDER BY created_at DESC
LIMIT 5;
```

## Resultado esperado:
```
| code        | carrier_name      | customer_name | order_id | store_name |
|-------------|-------------------|---------------|----------|------------|
| 12345678    | Coordinadora      | Juan Pérez    | 98765    | Tienda A   |
```

Si ves NULL en customer_name, order_id o store_name, entonces el problema está en la integración con Dunamixfy.
