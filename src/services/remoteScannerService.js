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
  async updateStatus(sessionId, status) {
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

    // Crear evento de cambio de estado
    await this.createEvent(sessionId, 'status_change', { status });
  },

  /**
   * Crear evento (scan, feedback, etc.)
   * @param {string} sessionId - UUID de la sesión
   * @param {string} eventType - 'scan' | 'feedback' | 'status_change' | 'client_connected' | 'client_disconnected'
   * @param {object} payload - Datos del evento
   * @param {string} clientId - UUID del cliente (opcional)
   */
  async createEvent(sessionId, eventType, payload, clientId = null) {
    const { data, error } = await supabase
      .from('remote_scanner_events')
      .insert({
        session_id: sessionId,
        event_type: eventType,
        payload,
        client_id: clientId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Subscribirse a eventos de una sesión (Realtime)
   * @param {string} sessionId - UUID de la sesión
   * @param {function} onEvent - Callback (event) => void
   * @returns {object} - Subscription object (para cleanup)
   */
  subscribeToSession(sessionId, onEvent) {
    console.log(`🔔 Suscribiéndose a sesión: ${sessionId}`);

    const channel = supabase
      .channel(`remote-scanner-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'remote_scanner_events',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          console.log('📩 Evento recibido:', payload.new);
          onEvent(payload.new);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Supabase Realtime status: ${status}`);
      });

    return channel;
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
   * Enviar feedback desde PC (HOST)
   * @param {string} sessionId - UUID de la sesión
   * @param {string} clientId - UUID del cliente que envió el scan
   * @param {boolean} success - Si el procesamiento fue exitoso
   * @param {string} message - Mensaje de feedback
   * @param {object} data - Datos adicionales (dispatch, etc.)
   */
  async sendFeedback(sessionId, clientId, success, message, data = {}) {
    return await this.createEvent(sessionId, 'feedback', {
      client_id: clientId,
      success,
      message,
      timestamp: new Date().toISOString(),
      ...data
    });
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
