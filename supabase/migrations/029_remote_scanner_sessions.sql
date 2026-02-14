-- =====================================================
-- Migration 029: Remote Scanner Sessions
-- =====================================================
-- Sistema de sesiones para Remote Scanner (PC + Mobile)
-- PC actúa como HOST, Mobile como CLIENT (solo cámara)
-- Comunicación via Supabase Realtime
-- =====================================================

-- 1. Tabla de sesiones remotas
CREATE TABLE IF NOT EXISTS remote_scanner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT NOT NULL UNIQUE, -- Código corto para QR (ej: "ABC123")
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),

  -- Stats de la sesión
  total_scanned INTEGER DEFAULT 0,
  total_success INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Configuración
  allow_multiple_clients BOOLEAN DEFAULT true, -- Permitir múltiples móviles
  auto_confirm BOOLEAN DEFAULT false -- Auto-confirmar dispatches (sin batch)
);

-- 2. Tabla de eventos de escaneo (para Realtime sync)
CREATE TABLE IF NOT EXISTS remote_scanner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES remote_scanner_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('scan', 'feedback', 'status_change', 'client_connected', 'client_disconnected')),

  -- Datos del evento
  payload JSONB NOT NULL, -- Flexible para diferentes tipos de eventos

  -- Tracking
  client_id TEXT, -- ID del cliente móvil (UUID temporal)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_sessions_code ON remote_scanner_sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_sessions_warehouse ON remote_scanner_sessions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sessions_operator ON remote_scanner_sessions(operator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON remote_scanner_sessions(status);

CREATE INDEX IF NOT EXISTS idx_events_session ON remote_scanner_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON remote_scanner_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON remote_scanner_events(event_type);

-- 4. Función: Generar código único de sesión (6 caracteres alfanuméricos)
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin O, 0, I, 1 (confusos)
  result TEXT := '';
  i INTEGER;
  max_attempts INTEGER := 100;
  attempt INTEGER := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Verificar si ya existe
    IF NOT EXISTS (SELECT 1 FROM remote_scanner_sessions WHERE session_code = result) THEN
      RETURN result;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'No se pudo generar código único después de % intentos', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger: Auto-generar session_code si no se proporciona
CREATE OR REPLACE FUNCTION set_session_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_code IS NULL OR NEW.session_code = '' THEN
    NEW.session_code := generate_session_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_session_code
  BEFORE INSERT ON remote_scanner_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_session_code();

-- 6. Trigger: Actualizar updated_at automáticamente
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON remote_scanner_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Row Level Security
ALTER TABLE remote_scanner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_scanner_events ENABLE ROW LEVEL SECURITY;

-- Permitir lectura/escritura para todos (simplificado para MVP)
CREATE POLICY "Enable all for remote_scanner_sessions"
  ON remote_scanner_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for remote_scanner_events"
  ON remote_scanner_events FOR ALL USING (true) WITH CHECK (true);

-- 8. Función: Limpiar sesiones antiguas (más de 24 horas)
CREATE OR REPLACE FUNCTION cleanup_old_scanner_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Eliminar sesiones completadas hace más de 24 horas
  DELETE FROM remote_scanner_sessions
  WHERE status = 'completed'
    AND completed_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- También eliminar sesiones activas abandonadas (más de 8 horas sin actividad)
  DELETE FROM remote_scanner_sessions
  WHERE status = 'active'
    AND updated_at < NOW() - INTERVAL '8 hours';

  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Habilitar Supabase Realtime (CRÍTICO para sincronización)
-- Esto permite que el PC reciba eventos en tiempo real cuando el móvil hace inserts
ALTER PUBLICATION supabase_realtime ADD TABLE remote_scanner_events;

-- 10. Comentarios
COMMENT ON TABLE remote_scanner_sessions IS 'Sesiones de Remote Scanner. PC crea sesión, Mobile se conecta via QR.';
COMMENT ON TABLE remote_scanner_events IS 'Eventos de escaneo en tiempo real. Usado para sincronización via Supabase Realtime.';
COMMENT ON COLUMN remote_scanner_sessions.session_code IS 'Código corto de 6 caracteres para QR (ej: ABC123)';
COMMENT ON COLUMN remote_scanner_sessions.allow_multiple_clients IS 'Si es true, múltiples móviles pueden conectarse a la misma sesión';
COMMENT ON COLUMN remote_scanner_events.event_type IS 'Tipos: scan (móvil escanea), feedback (PC responde), status_change, client_connected, client_disconnected';

-- 10. Ejemplo de uso (comentado)
/*
-- PC crea sesión
INSERT INTO remote_scanner_sessions (warehouse_id, operator_id)
VALUES (
  'warehouse-uuid',
  'operator-uuid'
)
RETURNING id, session_code; -- Retorna: "ABC123"

-- Mobile envía escaneo
INSERT INTO remote_scanner_events (session_id, event_type, payload, client_id)
VALUES (
  'session-uuid',
  'scan',
  '{"code": "1234567890", "timestamp": "2024-02-14T10:30:00Z"}'::jsonb,
  'client-uuid'
);

-- PC envía feedback
INSERT INTO remote_scanner_events (session_id, event_type, payload)
VALUES (
  'session-uuid',
  'feedback',
  '{"client_id": "client-uuid", "success": true, "message": "Guía procesada"}'::jsonb
);
*/
