-- Script para corregir la tabla orders
-- Problema: order_id tenia restriccion NOT NULL UNIQUE que causaba errores
-- Solucion: Hacer order_id opcional y mover UNIQUE a code

-- Paso 1: Eliminar la restriccion UNIQUE de order_id si existe
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_id_key;

-- Paso 2: Cambiar order_id para que sea opcional (permitir NULL)
ALTER TABLE orders ALTER COLUMN order_id DROP NOT NULL;

-- Paso 3: Asegurar que code tenga restriccion UNIQUE
ALTER TABLE orders ADD CONSTRAINT orders_code_unique UNIQUE (code);

-- Verificar cambios
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
