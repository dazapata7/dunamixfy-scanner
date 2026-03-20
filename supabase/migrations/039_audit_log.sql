-- =====================================================
-- MIGRATION 039: Audit Log (Rastro de Auditoría)
-- =====================================================
-- Tabla audit_log + triggers automáticos en tablas clave
-- Captura: quién hizo qué, cuándo, antes y después
-- =====================================================

-- ── Tabla de auditoría ────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Qué tabla y qué fila
  table_name     text        NOT NULL,
  record_id      text,                          -- id del registro afectado
  -- Qué acción
  action         text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  -- Estado antes/después (solo las columnas que cambiaron en UPDATE)
  old_data       jsonb,
  new_data       jsonb,
  -- Quién lo hizo
  changed_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  operator_name  text,                          -- nombre cacheado para lectura rápida
  -- Cuándo
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_log_table       ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record      ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user        ON audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON audit_log(created_at DESC);

-- RLS: solo usuarios autenticados leen; los inserts los hacen los triggers (SECURITY DEFINER)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_read"   ON audit_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true); -- triggers internos

-- ── Función trigger genérica ──────────────────────────
-- Se reutiliza en todas las tablas que quieras auditar.
-- Captura auth.uid() en el momento de la operación.
-- Solo guarda el diff en UPDATE (evita ruido).
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER           -- ejecuta con privilegios de propietario, no del caller
SET search_path = public   -- seguridad: evitar search_path injection
AS $$
DECLARE
  v_record_id   text;
  v_user_id     uuid;
  v_op_name     text;
  v_old_data    jsonb;
  v_new_data    jsonb;
  v_diff_old    jsonb := '{}'::jsonb;
  v_diff_new    jsonb := '{}'::jsonb;
  v_key         text;
BEGIN
  -- Obtener usuario actual (puede ser NULL si es llamada de función interna)
  v_user_id := auth.uid();

  -- Nombre cacheado del operador para legibilidad
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_op_name FROM operators WHERE id = v_user_id;
  END IF;

  -- ID del registro
  v_record_id := CASE TG_OP
    WHEN 'DELETE' THEN OLD.id::text
    ELSE NEW.id::text
  END;

  -- Calcular datos old/new
  CASE TG_OP
    WHEN 'INSERT' THEN
      v_old_data := NULL;
      v_new_data := to_jsonb(NEW);

    WHEN 'DELETE' THEN
      v_old_data := to_jsonb(OLD);
      v_new_data := NULL;

    WHEN 'UPDATE' THEN
      -- Solo guardar campos que realmente cambiaron (diff)
      FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW))
      LOOP
        IF (to_jsonb(OLD) -> v_key) IS DISTINCT FROM (to_jsonb(NEW) -> v_key) THEN
          v_diff_old := v_diff_old || jsonb_build_object(v_key, to_jsonb(OLD) -> v_key);
          v_diff_new := v_diff_new || jsonb_build_object(v_key, to_jsonb(NEW) -> v_key);
        END IF;
      END LOOP;
      -- Si nada cambió (ej: UPDATE sin cambios reales), no auditar
      IF v_diff_old = '{}'::jsonb THEN
        RETURN NEW;
      END IF;
      v_old_data := v_diff_old;
      v_new_data := v_diff_new;
  END CASE;

  INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by, operator_name)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_old_data, v_new_data, v_user_id, v_op_name);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Triggers en tablas clave ──────────────────────────

-- Movimientos de inventario (cada entrada/salida)
DROP TRIGGER IF EXISTS audit_inventory_movements ON inventory_movements;
CREATE TRIGGER audit_inventory_movements
  AFTER INSERT OR UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Despachos (creación, confirmación, cancelación)
DROP TRIGGER IF EXISTS audit_dispatches ON dispatches;
CREATE TRIGGER audit_dispatches
  AFTER INSERT OR UPDATE OR DELETE ON dispatches
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Devoluciones
DROP TRIGGER IF EXISTS audit_returns ON returns;
CREATE TRIGGER audit_returns
  AFTER INSERT OR UPDATE OR DELETE ON returns
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Productos (cambios de stock, nombre, SKU)
DROP TRIGGER IF EXISTS audit_products ON products;
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Operadores (cambios de rol, permisos, estado)
DROP TRIGGER IF EXISTS audit_operators ON operators;
CREATE TRIGGER audit_operators
  AFTER INSERT OR UPDATE OR DELETE ON operators
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ── Vista de consulta rápida ──────────────────────────
-- Muestra el log con info enriquecida para el panel de Admin
CREATE OR REPLACE VIEW v_audit_log AS
SELECT
  al.id,
  al.table_name,
  al.record_id,
  al.action,
  al.old_data,
  al.new_data,
  al.changed_by,
  COALESCE(al.operator_name, op.name, au.email, 'Sistema') AS actor,
  au.email                                                  AS actor_email,
  al.created_at
FROM audit_log al
LEFT JOIN auth.users  au ON au.id  = al.changed_by
LEFT JOIN operators   op ON op.id  = al.changed_by
ORDER BY al.created_at DESC;

COMMENT ON TABLE  audit_log IS 'Rastro de auditoría: cada cambio en tablas críticas con actor y diff';
COMMENT ON COLUMN audit_log.old_data IS 'Estado anterior (solo campos modificados en UPDATE)';
COMMENT ON COLUMN audit_log.new_data IS 'Estado nuevo (solo campos modificados en UPDATE)';
COMMENT ON COLUMN audit_log.changed_by IS 'auth.uid() del usuario que realizó la acción';
