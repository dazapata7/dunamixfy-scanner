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
   * @returns {Promise<Object>} - { items: [{sku, qty}], metadata, shipmentRecord }
   */
  async resolveShipment(guideCode, carrierId) {
    console.log(`📦 Resolviendo envío: ${guideCode} (carrier: ${carrierId})`);

    try {
      // 1. Obtener información de la transportadora
      const { data: carrier, error: carrierError } = await supabase
        .from('carriers')
        .select('*')
        .eq('id', carrierId)
        .single();

      if (carrierError) throw carrierError;

      console.log(`🚚 Transportadora: ${carrier.display_name} (${carrier.code})`);

      // 2. Resolver según transportadora
      if (carrier.code === 'coordinadora') {
        return await this.resolveCoordinadoraAPI(guideCode, carrier);
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
   */
  async resolveCoordinadoraAPI(guideCode, carrier) {
    console.log('🌐 Resolviendo desde API Dunamixfy...');

    try {
      // 1. Llamar API de Dunamixfy
      const apiResult = await dunamixfyApi.getOrderInfo(guideCode);

      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Error al consultar orden en Dunamixfy');
      }

      // 2. Verificar can_ship
      if (apiResult.canShip === false) {
        throw new Error('Pedido no listo para despachar (can_ship = false)');
      }

      const orderData = apiResult.data;

      // 3. Normalizar items a formato estándar
      // orderItems puede venir como array de productos
      const items = this.normalizeCoordinadoraItems(orderData.order_items);

      if (items.length === 0) {
        throw new Error('No se encontraron items en la orden');
      }

      // 4. Guardar en shipment_records (si no existe)
      const shipmentRecord = await this.createOrUpdateShipmentRecord({
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

      console.log(`✅ Envío resuelto desde API: ${items.length} items`);

      return {
        items,
        metadata: {
          guide_code: guideCode,
          order_id: orderData.order_id,
          customer_name: `${orderData.firstname} ${orderData.lastname}`,
          store: orderData.store,
          source: 'API'
        },
        shipmentRecord
      };

    } catch (error) {
      console.error('❌ Error al resolver Coordinadora desde API:', error);
      throw error;
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
          throw new Error(`Guía no encontrada en sistema. Debe importar CSV primero: ${guideCode}`);
        }
        throw shipmentError;
      }

      if (shipmentRecord.status === 'PROCESSED') {
        throw new Error('Esta guía ya fue procesada anteriormente');
      }

      // 2. Validar que tenga items
      if (!shipmentRecord.shipment_items || shipmentRecord.shipment_items.length === 0) {
        throw new Error('El envío no tiene items asociados');
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
      throw error;
    }
  },

  /**
   * Normalizar items de Coordinadora (desde API)
   * orderItems puede venir en varios formatos según Bubble
   */
  normalizeCoordinadoraItems(orderItems) {
    if (!orderItems || !Array.isArray(orderItems)) {
      console.warn('⚠️ orderItems no es un array válido:', orderItems);
      return [];
    }

    const items = orderItems.map(item => {
      // Formato esperado: { sku: "RODILLAX-50ML", qty: 2, product_name: "..." }
      // O puede venir como: { product_sku: "...", quantity: ... }

      const sku = item.sku || item.product_sku || item.SKU;
      const qty = item.qty || item.quantity || item.Quantity || 1;

      if (!sku) {
        console.warn('⚠️ Item sin SKU:', item);
        return null;
      }

      return {
        sku: sku.trim().toUpperCase(),
        qty: parseInt(qty, 10)
      };
    }).filter(Boolean);  // Filtrar nulls

    return items;
  },

  /**
   * Crear o actualizar shipment_record
   */
  async createOrUpdateShipmentRecord(shipmentData, items) {
    try {
      // 1. Verificar si ya existe
      const { data: existing, error: checkError } = await supabase
        .from('shipment_records')
        .select('*')
        .eq('guide_code', shipmentData.guide_code)
        .single();

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
