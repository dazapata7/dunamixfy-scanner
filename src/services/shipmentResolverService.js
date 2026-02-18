// =====================================================
// SHIPMENT RESOLVER SERVICE - Dunamix WMS
// =====================================================
// Resuelve items de envíos según transportadora:
// - COORDINADORA: desde API Dunamixfy
// - INTERRÁPIDISIMO: desde CSV importado en BD
// =====================================================

import { supabase } from './supabase';
import { dunamixfyApi } from './dunamixfyApi';
import { carriersService } from './supabase';

// =====================================================
// SHIPMENT RESOLVER SERVICE
// =====================================================

export const shipmentResolverService = {
  /**
   * Resolver envío según transportadora
   * @param {string} guideCode - Código de guía escaneado
   * @param {string} carrierId - ID de la transportadora
   * @param {boolean} skipRecord - Si es true, NO crea shipment_record (escaneo rápido)
   * @returns {Promise<Object>} - { items: [{sku, qty}], metadata, shipmentRecord }
   */
  /**
   * @param {Object} carrierObj - Objeto carrier completo (opcional, evita query a BD)
   */
  async resolveShipment(guideCode, carrierId, skipRecord = false, carrierObj = null) {
    console.log(`📦 Resolviendo envío: ${guideCode} (carrier: ${carrierId}) ${skipRecord ? '⚡ MODO RÁPIDO' : ''}`);

    try {
      // 1. Obtener carrier: usar objeto pasado (en memoria) o hacer query a BD
      let carrier = carrierObj;
      if (!carrier) {
        console.log('🐌 Carrier no en memoria, consultando BD...');
        const { data, error: carrierError } = await supabase
          .from('carriers')
          .select('*')
          .eq('id', carrierId)
          .single();
        if (carrierError) throw carrierError;
        carrier = data;
      }

      console.log(`🚚 Transportadora: ${carrier.display_name} (${carrier.code})`);

      // 2. Resolver según transportadora
      if (carrier.code === 'coordinadora') {
        return await this.resolveCoordinadoraAPI(guideCode, carrier, skipRecord);
      } else if (carrier.code === 'interrapidisimo') {
        return await this.resolveInterrapidisimoDB(guideCode, carrier);
      } else {
        throw new Error(`Transportadora no soportada para WMS: ${carrier.display_name}`);
      }

    } catch (error) {
      console.error('❌ Error al resolver envío:', error);
      throw error;
    }
  },

  /**
   * Resolver envío de COORDINADORA desde API Dunamixfy
   * @param {boolean} skipRecord - Si es true, NO crea shipment_record (solo valida y retorna data)
   */
  async resolveCoordinadoraAPI(guideCode, carrier, skipRecord = false) {
    console.log('🌐 Resolviendo desde API Dunamixfy...');

    try {
      // 1. Llamar API de Dunamixfy
      const apiResult = await dunamixfyApi.getOrderInfo(guideCode);

      if (!apiResult.success) {
        // ⚠️ RETORNAR ERROR CON CATEGORÍA (no throw)
        return {
          success: false,
          errorType: apiResult.errorType || 'ERROR_OTHER',
          error: apiResult.error || 'Error al consultar orden en Dunamixfy',
          rawError: apiResult.rawError
        };
      }

      // 2. Verificar can_ship
      if (apiResult.canShip === false) {
        return {
          success: false,
          errorType: 'ERROR_NOT_READY',
          error: '⚠️ Pedido no listo para despachar (can_ship = false)'
        };
      }

      const orderData = apiResult.data;

      // 3. Normalizar items a formato estándar
      // orderItems puede venir como array de productos
      const items = this.normalizeCoordinadoraItems(orderData.order_items);

      if (items.length === 0) {
        return {
          success: false,
          errorType: 'ERROR_OTHER',
          error: 'No se encontraron items en la orden'
        };
      }

      // 4. ⚡ OPTIMIZACIÓN: Si skipRecord=true, NO crear shipment_record (escaneo rápido)
      let shipmentRecord = null;

      if (!skipRecord) {
        shipmentRecord = await this.createOrUpdateShipmentRecord({
          carrier_id: carrier.id,
          guide_code: guideCode,
          source: 'API',
          status: 'READY',
          raw_payload: {
            order_id: orderData.order_id,
            customer_name: `${orderData.firstname} ${orderData.lastname}`,
            store: orderData.store,
            transportadora: orderData.transportadora,
            order_items: orderData.order_items,
            raw_response: orderData.raw_response
          }
        }, items);
      }

      console.log(`✅ Envío resuelto desde API: ${items.length} items ${skipRecord ? '(sin crear record - escaneo rápido)' : ''}`);

      return {
        success: true,
        items,
        metadata: {
          guide_code: guideCode,
          order_id: orderData.order_id,
          customer_name: `${orderData.firstname} ${orderData.lastname}`,
          store: orderData.store,
          source: 'API'
        },
        shipmentRecord,
        // Guardar raw_payload para crear record después (al confirmar)
        raw_payload: {
          carrier_id: carrier.id,
          guide_code: guideCode,
          source: 'API',
          status: 'READY',
          raw_payload: {
            order_id: orderData.order_id,
            customer_name: `${orderData.firstname} ${orderData.lastname}`,
            store: orderData.store,
            transportadora: orderData.transportadora,
            order_items: orderData.order_items,
            raw_response: orderData.raw_response
          }
        }
      };

    } catch (error) {
      console.error('❌ Error al resolver Coordinadora desde API:', error);
      // Retornar error con categoría en lugar de throw
      return {
        success: false,
        errorType: 'ERROR_OTHER',
        error: error.message || 'Error inesperado al resolver Coordinadora'
      };
    }
  },

  /**
   * Resolver envío de INTERRÁPIDISIMO desde BD (CSV importado)
   */
  async resolveInterrapidisimoDB(guideCode, carrier) {
    console.log('🗄️ Resolviendo desde BD (CSV importado)...');

    try {
      // 1. Buscar shipment_record en BD
      const { data: shipmentRecord, error: shipmentError } = await supabase
        .from('shipment_records')
        .select('*, shipment_items(*)')
        .eq('guide_code', guideCode)
        .eq('carrier_id', carrier.id)
        .single();

      if (shipmentError) {
        if (shipmentError.code === 'PGRST116') {
          return {
            success: false,
            errorType: 'ERROR_NOT_FOUND',
            error: `❌ Guía no encontrada en sistema. Debe importar CSV primero: ${guideCode}`
          };
        }
        return {
          success: false,
          errorType: 'ERROR_OTHER',
          error: shipmentError.message || 'Error al buscar guía en BD'
        };
      }

      if (shipmentRecord.status === 'PROCESSED') {
        return {
          success: false,
          errorType: 'ALREADY_SCANNED_EXTERNAL',
          error: '🔄 Esta guía ya fue procesada anteriormente'
        };
      }

      // 2. Validar que tenga items
      if (!shipmentRecord.shipment_items || shipmentRecord.shipment_items.length === 0) {
        return {
          success: false,
          errorType: 'ERROR_OTHER',
          error: 'El envío no tiene items asociados'
        };
      }

      // 3. Normalizar items a formato estándar
      const items = shipmentRecord.shipment_items.map(item => ({
        sku: item.sku,
        qty: item.qty,
        product_id: item.product_id  // Puede ser null si no se mapeó aún
      }));

      console.log(`✅ Envío resuelto desde BD: ${items.length} items`);

      // 4. Extraer metadata adicional del raw_payload (si existe)
      const rawPayload = shipmentRecord.raw_payload || {};

      return {
        success: true,
        items,
        metadata: {
          guide_code: guideCode,
          source: 'CSV',
          batch_id: rawPayload.batch_id,
          order_id: rawPayload.order_id,
          customer_name: rawPayload.customer_name,
          store: rawPayload.store || rawPayload.dropshipper,  // NOMBRE TIENDA o DROPSHIPPER
          warehouse: rawPayload.warehouse
        },
        shipmentRecord
      };

    } catch (error) {
      console.error('❌ Error al resolver Interrápidisimo desde BD:', error);
      // Retornar error con categoría en lugar de throw
      return {
        success: false,
        errorType: 'ERROR_OTHER',
        error: error.message || 'Error inesperado al resolver Interrápidisimo'
      };
    }
  },

  /**
   * Normalizar items de Coordinadora (desde API)
   * orderItems puede venir en varios formatos según Bubble:
   * - STRING JSON (necesita JSON.parse)
   * - Objeto único (convertir a array)
   * - Array de objetos (formato ideal)
   */
  normalizeCoordinadoraItems(orderItems) {
    if (!orderItems) {
      console.warn('⚠️ orderItems es null/undefined');
      return [];
    }

    let parsedItems = orderItems;

    // Si es string, parsear JSON
    if (typeof orderItems === 'string') {
      try {
        // 🔍 DEBUG: Ver contenido antes de parsear
        console.log('📝 orderItems string (primeros 300 chars):', orderItems.substring(0, 300));

        // Limpiar posibles caracteres problemáticos
        let cleanedItems = orderItems
          .trim()
          .replace(/\r\n/g, '') // Eliminar saltos de línea Windows
          .replace(/\n/g, '')   // Eliminar saltos de línea Unix
          .replace(/\t/g, '');  // Eliminar tabs

        // 🔥 FIX: Si NO empieza con '[', envolver en array
        // Dunamixfy a veces retorna: {"sku":"446"},{"sku":"448"}
        // En lugar de: [{"sku":"446"},{"sku":"448"}]
        if (!cleanedItems.startsWith('[')) {
          console.log('🔧 orderItems sin corchetes - envolviéndolo en array');
          cleanedItems = `[${cleanedItems}]`;
        }

        parsedItems = JSON.parse(cleanedItems);
        console.log('✅ orderItems parseado desde JSON string');
      } catch (e) {
        console.error('❌ Error parseando orderItems JSON:', e);
        console.error('📄 Contenido completo:', orderItems);
        console.error('📏 Longitud:', orderItems.length);
        console.error('🔍 Caracteres alrededor posición 199:', orderItems.substring(190, 210));
        return [];
      }
    }

    // Si es objeto único, convertir a array
    if (!Array.isArray(parsedItems)) {
      console.log('🔄 Convirtiendo objeto único a array');
      parsedItems = [parsedItems];
    }

    const items = parsedItems.map(item => {
      // Formato esperado: { sku: "210", quantity: 2, name: "Lumbrax" }
      const sku = item.sku || item.product_sku || item.SKU;
      const qty = item.qty || item.quantity || item.Quantity || 1;

      if (!sku) {
        console.warn('⚠️ Item sin SKU:', item);
        return null;
      }

      return {
        sku: sku.toString().trim().toUpperCase(),
        qty: parseInt(qty, 10)
      };
    }).filter(Boolean);  // Filtrar nulls

    console.log(`✅ Items normalizados: ${items.length} productos`);
    return items;
  },

  /**
   * Crear o actualizar shipment_record
   */
  async createOrUpdateShipmentRecord(shipmentData, items) {
    try {
      // 1. Verificar si ya existe (maybeSingle no lanza 406 si no encuentra)
      const { data: existing, error: checkError } = await supabase
        .from('shipment_records')
        .select('*')
        .eq('guide_code', shipmentData.guide_code)
        .maybeSingle();

      let shipmentRecord;

      if (existing) {
        // Ya existe, actualizar si es necesario
        console.log('📝 Actualizando shipment_record existente...');
        const { data: updated, error: updateError } = await supabase
          .from('shipment_records')
          .update({
            raw_payload: shipmentData.raw_payload,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        shipmentRecord = updated;

      } else {
        // Crear nuevo
        console.log('📝 Creando nuevo shipment_record...');
        const { data: created, error: createError } = await supabase
          .from('shipment_records')
          .insert([shipmentData])
          .select()
          .single();

        if (createError) throw createError;
        shipmentRecord = created;

        // 2. Crear shipment_items
        const itemsToInsert = items.map(item => ({
          shipment_record_id: shipmentRecord.id,
          sku: item.sku,
          qty: item.qty,
          product_id: item.product_id || null
        }));

        const { error: itemsError } = await supabase
          .from('shipment_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        console.log(`✅ Shipment record creado con ${items.length} items`);
      }

      return shipmentRecord;

    } catch (error) {
      console.error('❌ Error al crear/actualizar shipment_record:', error);
      throw error;
    }
  },

  /**
   * Marcar shipment_record como PROCESSED
   */
  async markAsProcessed(shipmentRecordId) {
    console.log(`✅ Marcando shipment_record como PROCESSED: ${shipmentRecordId}`);

    const { data, error } = await supabase
      .from('shipment_records')
      .update({
        status: 'PROCESSED',
        processed_at: new Date().toISOString()
      })
      .eq('id', shipmentRecordId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al marcar como procesado:', error);
      throw error;
    }

    console.log('✅ Shipment record marcado como PROCESSED');
    return data;
  },

  /**
   * Marcar shipment_record con ERROR
   */
  async markAsError(shipmentRecordId, errorMessage) {
    console.error(`❌ Marcando shipment_record como ERROR: ${errorMessage}`);

    const { data, error } = await supabase
      .from('shipment_records')
      .update({
        status: 'ERROR',
        raw_payload: {
          error: errorMessage,
          error_date: new Date().toISOString()
        }
      })
      .eq('id', shipmentRecordId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al marcar como error:', error);
      throw error;
    }

    return data;
  },

  /**
   * Obtener shipment_record por guide_code
   */
  async getByGuideCode(guideCode) {
    const { data, error } = await supabase
      .from('shipment_records')
      .select('*, shipment_items(*)')
      .eq('guide_code', guideCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }
};

export default shipmentResolverService;
