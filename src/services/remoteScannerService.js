// =====================================================
// REMOTE SCANNER SERVICE - Dunamix WMS
// =====================================================
// Servicio para Remote Scanner (PC + Mobile)
// PC = HOST, Mobile = CLIENT (solo cámara)
// Comunicación via Supabase Realtime
// =====================================================

import { supabase } from './supabase';

export const remoteScannerService = {
  /**
   * Crear nueva sesión de Remote Scanner (HOST - PC)
   * @param {string} warehouseId - UUID del almacén
   * @param {string} operatorId - UUID del operador
   * @param {object} options - Opciones de configuración
   * @returns {object} - {id, session_code, ...}
   */
  async createSession(warehouseId, operatorId, options = {}) {
    const { data, error } = await supabase
      .from('remote_scanner_sessions')
      .insert({
        warehouse_id: warehouseId,
        operator_id: operatorId,
        allow_multiple_clients: options.allowMultipleClients ?? true,
        auto_confirm: options.autoConfirm ?? false
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Sesión remota creada: ${data.session_code}`);
    return data;
  },

  /**
   * Obtener sesión por código (CLIENT - Mobile escanea QR)
   * @param {string} sessionCode - Código de 6 caracteres
   * @returns {object|null} - Sesión encontrada o null
   */
  async getSessionByCode(sessionCode) {
    const { data, error } = await supabase
      .from('remote_scanner_sessions')
      .select(`
        *,
        warehouse:warehouses(id, name),
        operator:operators(id, name)
      `)
      .eq('session_code', sessionCode.toUpperCase())
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    return data;
  },

  /**
   * Actualizar stats de la sesión
   * @param {string} sessionId - UUID de la sesión
   * @param {object} stats - {total_scanned, total_success, total_errors}
   */
  async updateStats(sessionId, stats) {
    const { error } = await supabase
      .from('remote_scanner_sessions')
      .update({
        total_scanned: stats.total_scanned,
        total_success: stats.total_success,
        total_errors: stats.total_errors,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Cambiar estado de la sesión
   * @param {string} sessionId - UUID de la sesión
   * @param {string} status - 'active' | 'paused' | 'completed'
   */
  async updateStatus(sessionId, status, channel = null) {
    const update = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      update.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('remote_scanner_sessions')
      .update(update)
      .eq('id', sessionId);

    if (error) throw error;

    // ⚡ Si hay canal, usar broadcast (instantáneo). Si no, usar BD (fallback).
    if (channel) {
      this.broadcastEvent(channel, 'status_change', { status });
    } else {
      // Fallback: persistir en BD (sin await para no bloquear)
      this.createEvent(sessionId, 'status_change', { status }).catch(console.warn);
    }
  },

  /**
   * Crear evento (scan, client_connected, etc.) - persiste en BD para historial
   * @param {string} sessionId - UUID de la sesión
   * @param {string} eventType - 'scan' | 'feedback' | 'status_change' | 'client_connected' | 'client_disconnected'
   * @param {object} payload - Datos del evento
   * @param {string} clientId - UUID del cliente (opcional)
   */
  async createEvent(sessionId, eventType, payload, clientId = null) {
    // ⚡ Sin .select() - no necesitamos el resultado, solo insertar
    const { error } = await supabase
      .from('remote_scanner_events')
      .insert({
        session_id: sessionId,
        event_type: eventType,
        payload,
        client_id: clientId
      });

    if (error) throw error;
  },

  /**
   * ⚡ BROADCAST: Enviar mensaje instantáneo via Supabase Realtime Broadcast
   * ~50ms latencia vs ~500ms de postgres_changes
   * @param {object} channel - Canal ya suscrito
   * @param {string} eventType - Tipo de evento
   * @param {object} payload - Datos del evento
   */
  broadcastEvent(channel, eventType, payload) {
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: eventType,
      payload
    });
  },

  /**
   * Subscribirse a eventos de una sesión (Realtime)
   * Usa BROADCAST para feedback (ultra-rápido ~50ms) +
   * postgres_changes para scan/connect (persistencia en BD)
   * @param {string} sessionId - UUID de la sesión
   * @param {function} onEvent - Callback (event) => void
   * @returns {object} - Channel object (para cleanup y broadcast)
   */
  subscribeToSession(sessionId, onEvent, onStatusChange = null) {
    console.log(`🔔 Suscribiéndose a sesión: ${sessionId}`);

    const channel = supabase
      .channel(`remote-scanner-${sessionId}`)
      // ⚡ BROADCAST: Recibir feedback instantáneo (Host→Mobile)
      .on('broadcast', { event: 'feedback' }, ({ payload }) => {
        onEvent({ event_type: 'feedback', payload, client_id: payload.client_id });
      })
      // ⚡ BROADCAST: Recibir cambios de estado instantáneos
      .on('broadcast', { event: 'status_change' }, ({ payload }) => {
        onEvent({ event_type: 'status_change', payload });
      })
      // ⚡ BROADCAST: Heartbeat HOST→CLIENT (keepalive)
      .on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
        onEvent({ event_type: 'heartbeat', payload });
      })
      // postgres_changes: Recibir scans y conexiones (necesita persistencia en BD)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'remote_scanner_events',
          filter: `session_id=eq.${sessionId}`
        },
        (pgPayload) => {
          const event = pgPayload.new;
          // Ignorar eventos de feedback/status_change (ya llegan por broadcast)
          if (event.event_type === 'feedback' || event.event_type === 'status_change') return;
          console.log('📩 Evento DB recibido:', event.event_type);
          onEvent(event);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Supabase Realtime status: ${status}`);
        // Notificar cambios de estado del canal al componente
        if (onStatusChange) {
          onStatusChange(status); // 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT'
        }
      });

    return channel;
  },

  /**
   * ⚡ Enviar heartbeat desde HOST a todos los clientes conectados
   * El cliente lo usa para saber que el canal sigue vivo
   */
  sendHeartbeat(channel) {
    if (!channel) return;
    channel.send({
      type: 'broadcast',
      event: 'heartbeat',
      payload: { ts: Date.now() }
    });
  },

  /**
   * Desuscribirse de eventos
   * @param {object} channel - Channel object de subscribeToSession
   */
  async unsubscribe(channel) {
    if (channel) {
      await supabase.removeChannel(channel);
      console.log('🔕 Desuscrito de sesión remota');
    }
  },

  /**
   * Enviar escaneo desde Mobile (CLIENT)
   * @param {string} sessionId - UUID de la sesión
   * @param {string} code - Código escaneado
   * @param {string} clientId - UUID del cliente móvil
   */
  async sendScan(sessionId, code, clientId) {
    return await this.createEvent(sessionId, 'scan', {
      code,
      timestamp: new Date().toISOString()
    }, clientId);
  },

  /**
   * ⚡ Enviar feedback desde PC (HOST) via BROADCAST (instantáneo ~50ms)
   * @param {object} channel - Canal de Realtime (del subscribeToSession)
   * @param {string} clientId - UUID del cliente que envió el scan
   * @param {boolean} success - Si el procesamiento fue exitoso
   * @param {string} message - Mensaje de feedback
   * @param {object} data - Datos adicionales (dispatch, etc.)
   */
  sendFeedback(channel, clientId, success, message, data = {}) {
    const payload = {
      client_id: clientId,
      success,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };
    // ⚡ Broadcast inmediato - no espera BD
    this.broadcastEvent(channel, 'feedback', payload);
  },

  /**
   * Notificar conexión de cliente (Mobile se conecta)
   * @param {string} sessionId - UUID de la sesión
   * @param {string} clientId - UUID del cliente móvil
   * @param {object} clientInfo - Info del cliente (navegador, etc.)
   */
  async notifyClientConnected(sessionId, clientId, clientInfo = {}) {
    return await this.createEvent(sessionId, 'client_connected', {
      client_id: clientId,
      timestamp: new Date().toISOString(),
      ...clientInfo
    }, clientId);
  },

  /**
   * Notificar desconexión de cliente
   * @param {string} sessionId - UUID de la sesión
   * @param {string} clientId - UUID del cliente móvil
   */
  async notifyClientDisconnected(sessionId, clientId) {
    return await this.createEvent(sessionId, 'client_disconnected', {
      client_id: clientId,
      timestamp: new Date().toISOString()
    }, clientId);
  },

  /**
   * Limpiar sesiones antiguas (llamar periódicamente)
   */
  async cleanupOldSessions() {
    const { data, error } = await supabase.rpc('cleanup_old_scanner_sessions');

    if (error) throw error;

    console.log(`🧹 Sesiones antiguas limpiadas: ${data}`);
    return data;
  }
};

export default remoteScannerService;
