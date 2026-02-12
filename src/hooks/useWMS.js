// =====================================================
// USE WMS HOOK - Dunamix Scanner
// =====================================================
// Hook principal para funcionalidad WMS
// Maneja: warehouses, scan guide, dispatch, validación
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { warehousesService, dispatchesService } from '../services/wmsService';
import { shipmentResolverService } from '../services/shipmentResolverService';
import { inventoryService, productsService } from '../services/wmsService';
import { procesarCodigoConCarriers } from '../utils/validators';
import { carriersService, codesService } from '../services/supabase';
import { dunamixfyApi } from '../services/dunamixfyApi';
import { dunamixfyService } from '../services/dunamixfyService';
import toast from 'react-hot-toast';

export function useWMS() {
  // Leer selectedWarehouse del store de Zustand (persistente)
  const { selectedWarehouse } = useStore();

  const [warehouses, setWarehouses] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // useRef para acceder al estado actual de carriers dentro de funciones
  const carriersRef = useRef([]);

  // =====================================================
  // INICIALIZACIÓN
  // =====================================================

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setIsLoading(true);
    try {
      // Cargar warehouses y carriers en paralelo
      const [warehousesData, carriersData] = await Promise.all([
        warehousesService.getAll(),
        carriersService.getAll()
      ]);

      setWarehouses(warehousesData);
      setCarriers(carriersData);
      carriersRef.current = carriersData; // Actualizar ref

      console.log(`✅ WMS inicializado: ${warehousesData.length} almacenes, ${carriersData.length} carriers`);

    } catch (error) {
      console.error('❌ Error al cargar datos iniciales WMS:', error);
      toast.error('Error al cargar datos del WMS');
    } finally {
      setIsLoading(false);
    }
  }

  // =====================================================
  // SCAN GUIDE FOR DISPATCH
  // =====================================================

  /**
   * Escanear guía y crear dispatch (draft)
   * Flujo completo: detectar carrier → resolver items → validar stock → crear dispatch
   * NOTA: NO usar useCallback aquí para que siempre capture carriers actualizado
   */
  const scanGuideForDispatch = async (rawCode, operatorId) => {
    if (!selectedWarehouse) {
      throw new Error('Debe seleccionar un almacén primero');
    }

    if (!operatorId) {
      console.error('❌ operatorId no existe:', operatorId);
      throw new Error('❌ NO HAY OPERADOR\nDebe hacer login desde el Dashboard principal primero');
    }

    console.log('🔍 WMS: Procesando guía:', rawCode);
    setIsProcessing(true);

    try {
      // 1. Detectar transportadora
      // IMPORTANTE: Usar carriersRef para obtener el estado más reciente
      let currentCarriers = carriersRef.current;
      console.log(`📋 Carriers cargados: ${currentCarriers.length}`);
      currentCarriers.forEach(c => console.log(`  - ${c.display_name} (${c.code}): ${c.is_active ? 'ACTIVA' : 'INACTIVA'}`));

      if (currentCarriers.length === 0) {
        console.error('❌ No hay carriers cargados. Reintentando carga...');
        await loadInitialData();
        // Usar ref para obtener carriers actualizados
        currentCarriers = carriersRef.current;
        console.log(`🔄 Después de recargar: ${currentCarriers.length} carriers`);
        if (currentCarriers.length === 0) {
          throw new Error('No se pudieron cargar las transportadoras. Recargue la página.');
        }
      }

      // CRITICAL: Detectar transportadora (procesarCodigoConCarriers retorna objeto sincrónico)
      const detectionResult = procesarCodigoConCarriers(rawCode, currentCarriers);
      console.log('🔍 detectionResult recibido en useWMS:', JSON.stringify(detectionResult, null, 2));
      console.log('🔍 detectionResult.valido:', detectionResult.valido);

      if (!detectionResult.valido) {
        console.error('❌ Código no válido para ninguna transportadora');
        console.error('Código recibido:', rawCode);
        console.error('Longitud:', rawCode.length);
        throw new Error(`⚠️ TRANSPORTADORA NO IDENTIFICADA\nCódigo: ${rawCode.substring(0, 20)}...\nVerifique que sea Coordinadora o Interrápidisimo`);
      }

      const { codigo, carrierId, carrierName, carrierCode } = detectionResult;

      console.log(`🚚 Transportadora detectada: ${carrierName} (${codigo})`);

      // 1.5. VALIDACIÓN DUNAMIXFY (solo Coordinadora)
      // Consultar información de la orden y validar can_ship ANTES de continuar
      const isCoordinadora = carrierName.toLowerCase().includes('coordinadora');
      let customerName = null;
      let orderId = null;
      let storeName = null;

      if (isCoordinadora) {
        try {
          console.log('🌐 [COORDINADORA] Consultando orden en Dunamixfy...');
          const orderInfo = await dunamixfyApi.getOrderInfo(codigo);

          if (orderInfo.success) {
            console.log('✅ Orden encontrada en Dunamixfy:', orderInfo.data);

            // Extraer info del cliente
            const firstName = orderInfo.data.firstname || '';
            const lastName = orderInfo.data.lastname || '';
            customerName = `${firstName} ${lastName}`.trim();
            orderId = orderInfo.data.order_id || null;
            storeName = orderInfo.data.store || null;

            // Mostrar info del cliente
            if (customerName) {
              toast.success(`👤 ${customerName}`, {
                duration: 4000,
                icon: '📦',
                style: {
                  background: '#3b82f6',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  padding: '16px 24px',
                  borderRadius: '12px',
                }
              });
            }
          } else if (orderInfo.canShip === false) {
            // ⛔ PEDIDO NO PUEDE SER DESPACHADO (can_ship = NO)
            console.error('🚫 PEDIDO CON ERROR:', orderInfo.error);

            // Determinar categoría del error
            let category = 'ERROR_OTHER';
            if (orderInfo.errorType === 'NOT_READY') {
              category = 'ERROR_NOT_READY';
            } else if (orderInfo.errorType === 'NOT_FOUND') {
              category = 'ERROR_NOT_FOUND';
            } else if (orderInfo.errorType === 'ALREADY_SCANNED') {
              category = 'ALREADY_SCANNED_EXTERNAL';
            }

            toast.error(orderInfo.error || 'Error al procesar guía', {
              duration: 6000,
              icon: '⚠️',
              style: {
                background: '#ef4444',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                padding: '16px 24px',
                borderRadius: '12px',
              }
            });

            // Vibración de alerta
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }

            // NO lanzar error, retornar clasificación
            return {
              dispatch: null,
              category,
              isDuplicate: category === 'ALREADY_SCANNED_EXTERNAL',
              hasError: true,
              errorType: orderInfo.errorType,
              message: orderInfo.error || 'Error al procesar guía',
              rawError: orderInfo.rawError, // Mensaje original de Dunamixfy sin procesar
              feedbackInfo: {
                code: codigo,
                carrier: carrierName,
                customerName: customerName || null,
                orderId,
                storeName,
                itemsCount: 0
              }
            };
          } else {
            console.warn('⚠️ Orden no encontrada en Dunamixfy:', orderInfo.error);
          }
        } catch (dunamixfyError) {
          console.error('❌ Error consultando Dunamixfy:', dunamixfyError);
          // Continuar aunque falle la consulta (para otros errores de red)
        }
      } else {
        console.log(`ℹ️ [${carrierName}] No requiere consulta a Dunamixfy`);
      }

      // 2. Verificar idempotencia (que no exista dispatch con esta guía)
      console.log(`🔍 Verificando si existe dispatch para guía: ${codigo}`);
      const existingDispatch = await dispatchesService.getByGuideCode(codigo);
      console.log('📦 Resultado de búsqueda de dispatch existente:', existingDispatch);

      if (existingDispatch) {
        console.warn(`⚠️ DISPATCH EXISTENTE ENCONTRADO:`, {
          id: existingDispatch.id,
          status: existingDispatch.status,
          guide_code: existingDispatch.guide_code,
          created_at: existingDispatch.created_at,
          confirmed_at: existingDispatch.confirmed_at
        });

        if (existingDispatch.status === 'confirmed') {
          const confirmedDate = existingDispatch.confirmed_at
            ? new Date(existingDispatch.confirmed_at)
            : new Date(existingDispatch.created_at);

          const today = new Date();
          const dispatchDate = new Date(confirmedDate);

          // Verificar si es de hoy (mismo día)
          const isToday =
            dispatchDate.getDate() === today.getDate() &&
            dispatchDate.getMonth() === today.getMonth() &&
            dispatchDate.getFullYear() === today.getFullYear();

          console.warn(`⚠️ Guía ${codigo} ya fue confirmada ${isToday ? 'HOY' : 'en otro día'}`);

          // NO lanzar error, retornar clasificación
          return {
            dispatch: existingDispatch,
            category: isToday ? 'REPEATED_TODAY' : 'REPEATED_OTHER_DAY',
            isDuplicate: true,
            isToday,
            confirmedAt: confirmedDate,
            message: isToday
              ? `Repetida HOY - ${confirmedDate.toLocaleTimeString()}`
              : `Repetida de ${confirmedDate.toLocaleDateString()}`,
            feedbackInfo: {
              code: codigo,
              carrier: carrierName,
              customerName: customerName || 'Cliente',
              orderId,
              storeName,
              itemsCount: existingDispatch.dispatch_items?.length || 0
            }
          };
        } else {
          // Existe pero en draft
          console.warn(`⚠️ Ya existe un dispatch en DRAFT para esta guía (ID: ${existingDispatch.id})`);
          return {
            dispatch: existingDispatch,
            category: 'DRAFT_DUPLICATE',
            isDuplicate: true,
            message: 'Esta guía ya tiene un despacho en borrador',
            feedbackInfo: {
              code: codigo,
              carrier: carrierName,
              customerName: customerName || 'Cliente',
              orderId,
              storeName,
              itemsCount: existingDispatch.dispatch_items?.length || 0
            }
          };
        }
      }

      console.log('✅ No existe dispatch previo para esta guía, continuando...');

      // 3. Resolver items del envío según transportadora
      const shipmentData = await shipmentResolverService.resolveShipment(codigo, carrierId);

      // 3.1 Verificar si shipmentResolverService retornó error
      if (!shipmentData.success) {
        console.error('❌ Error al resolver envío:', shipmentData.error);

        // Determinar categoría del error
        let category = 'ERROR_OTHER';
        if (shipmentData.errorType === 'NOT_READY' || shipmentData.errorType === 'ERROR_NOT_READY') {
          category = 'ERROR_NOT_READY';
        } else if (shipmentData.errorType === 'NOT_FOUND' || shipmentData.errorType === 'ERROR_NOT_FOUND') {
          category = 'ERROR_NOT_FOUND';
        } else if (shipmentData.errorType === 'ALREADY_SCANNED' || shipmentData.errorType === 'ALREADY_SCANNED_EXTERNAL') {
          category = 'ALREADY_SCANNED_EXTERNAL';
        }

        // Retornar clasificación en lugar de throw
        return {
          dispatch: null,
          category,
          isDuplicate: category === 'ALREADY_SCANNED_EXTERNAL',
          hasError: true,
          errorType: shipmentData.errorType,
          message: shipmentData.error || 'Error al procesar guía',
          rawError: shipmentData.rawError,
          feedbackInfo: {
            code: codigo,
            carrier: carrierName,
            customerName: null,
            orderId: null,
            storeName: null,
            itemsCount: 0
          }
        };
      }

      console.log(`📦 Items resueltos: ${shipmentData.items.length} productos`);

      // 4. Mapear SKUs a product_ids (pasando source para mappings externos)
      const source = carrierCode === 'coordinadora' ? 'dunamixfy' : carrierCode;
      const itemsWithProducts = await mapSkusToProducts(shipmentData.items, source);

      console.log(`✅ Items mapeados: ${itemsWithProducts.length} productos encontrados`);

      // 5. Validar stock disponible
      const stockValidation = await inventoryService.validateStock(
        selectedWarehouse.id,
        itemsWithProducts
      );

      if (!stockValidation.valid) {
        console.warn('⚠️ Stock insuficiente:', stockValidation.results);
        // No lanzar error, dejar que el usuario decida (en preview)
      }

      // 6. Crear dispatch (draft) + items
      // IMPORTANTE: first_scanned_at se marca automáticamente por trigger
      // first_scanned_by registra quién hizo el primer escaneo (trazabilidad)
      const dispatch = await dispatchesService.create({
        warehouse_id: selectedWarehouse.id,
        operator_id: operatorId,
        carrier_id: carrierId,
        guide_code: codigo,
        first_scanned_by: operatorId,  // Registrar quién hizo el primer escaneo
        notes: `Creado desde escaneo WMS - ${carrierName}`
      }, itemsWithProducts);

      console.log(`✅ Dispatch creado: ${dispatch.dispatch_number}`);

      // 7. INTEGRACIÓN: Registrar también en tabla codes (scanner DMX5 legacy)
      // Esto mantiene compatibilidad con el sistema de escaneo original
      try {
        await codesService.create({
          operator_id: operatorId,
          code: codigo,
          type: 'guide',  // Tipo específico para guías WMS
          carrier_id: carrierId,
          carrier_name: carrierName,
          order_id: shipmentData.metadata?.order_id || null,
          customer_name: shipmentData.metadata?.customer_name || null,
          store_name: shipmentData.metadata?.store || null
        });
        console.log(`✅ Código registrado en tabla codes (integración DMX5)`);
      } catch (codeError) {
        // No fallar el dispatch si falla el registro en codes (es legacy)
        console.warn('⚠️ No se pudo registrar en tabla codes:', codeError);
      }

      // Retornar dispatch + metadata + validación stock + feedback info
      return {
        dispatch,
        metadata: shipmentData.metadata,
        stockValidation,
        shipmentRecord: shipmentData.shipmentRecord,
        category: 'SUCCESS', // ✅ Guía nueva procesada exitosamente
        isDuplicate: false,
        hasError: false,
        // Info para feedback visual (ScanGuide.jsx lo usa para mostrar al usuario)
        feedbackInfo: {
          code: codigo,
          carrier: carrierName,
          customerName: customerName || shipmentData.metadata?.customer_name,
          orderId: orderId || shipmentData.metadata?.order_id,
          storeName: storeName || shipmentData.metadata?.store,
          itemsCount: itemsWithProducts.length
        }
      };

    } catch (error) {
      console.error('❌ Error al procesar guía:', error);
      toast.error(error.message || 'Error al procesar la guía');
      throw error;

    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Mapear SKUs a product_ids
   * Si el producto no existe, retorna error en el item
   * @param {Array} items - Items con {sku, qty}
   * @param {string} source - Fuente del SKU externo ('dunamixfy', 'interrapidisimo', etc.)
   */
  async function mapSkusToProducts(items, source = null) {
    const mappedItems = [];

    for (const item of items) {
      try {
        // Buscar producto por SKU (primero intenta mapping externo si hay source)
        const product = await productsService.getBySku(item.sku, source);

        if (!product) {
          // Producto no encontrado
          mappedItems.push({
            ...item,
            product_id: null,
            error: `Producto no encontrado: ${item.sku}${source ? ` (${source})` : ''}`
          });
        } else {
          mappedItems.push({
            ...item,
            product_id: product.id,
            product_name: product.name
          });
        }

      } catch (error) {
        console.error(`❌ Error mapeando SKU ${item.sku}:`, error);
        mappedItems.push({
          ...item,
          product_id: null,
          error: error.message
        });
      }
    }

    // Verificar si hay errores
    const itemsWithErrors = mappedItems.filter(i => i.error);
    if (itemsWithErrors.length > 0) {
      throw new Error(`Productos no encontrados: ${itemsWithErrors.map(i => i.sku).join(', ')}`);
    }

    return mappedItems;
  }

  // =====================================================
  // CONFIRM DISPATCH
  // =====================================================

  /**
   * Confirmar dispatch (validar stock + crear movimientos OUT + marcar shipment_record)
   */
  const confirmDispatch = async (dispatchId, shipmentRecordId) => {
    console.log(`✅ Confirmando dispatch: ${dispatchId}`);
    setIsProcessing(true);

    try {
      // 1. Confirmar dispatch (crea movimientos OUT)
      const confirmedDispatch = await dispatchesService.confirm(dispatchId);

      // 2. Marcar shipment_record como PROCESSED
      if (shipmentRecordId) {
        await shipmentResolverService.markAsProcessed(shipmentRecordId);
      }

      // 3. Marcar orden como SCANNED en Dunamixfy (solo para Coordinadora)
      if (confirmedDispatch.guide_code && confirmedDispatch.carrier_id) {
        // Obtener carrier para verificar si es Coordinadora
        const carrier = carriers.find(c => c.id === confirmedDispatch.carrier_id);

        if (carrier && carrier.code === 'coordinadora') {
          console.log(`📤 Marcando orden como SCANNED en Dunamixfy...`);
          try {
            await dunamixfyService.markOrderAsScanned(confirmedDispatch.guide_code, {
              warehouse_id: confirmedDispatch.warehouse_id,
              operator_id: confirmedDispatch.operator_id,
              dispatch_number: confirmedDispatch.dispatch_number
            });
            console.log(`✅ Orden marcada como SCANNED en Dunamixfy`);
          } catch (dunamixfyError) {
            // No fallar el dispatch si falla Dunamixfy
            console.warn('⚠️ Error al marcar como scanned en Dunamixfy:', dunamixfyError);
          }
        }
      }

      console.log('✅ Dispatch confirmado exitosamente');
      toast.success('Despacho confirmado exitosamente');

      return confirmedDispatch;

    } catch (error) {
      console.error('❌ Error al confirmar dispatch:', error);
      toast.error(error.message || 'Error al confirmar el despacho');

      // Si hay error y tenemos shipmentRecordId, marcarlo como ERROR
      if (shipmentRecordId) {
        try {
          await shipmentResolverService.markAsError(shipmentRecordId, error.message);
        } catch (markError) {
          console.error('❌ Error al marcar shipment como error:', markError);
        }
      }

      throw error;

    } finally {
      setIsProcessing(false);
    }
  };

  // =====================================================
  // CANCEL DISPATCH
  // =====================================================

  /**
   * Cancelar/eliminar dispatch en draft
   */
  const cancelDispatch = async (dispatchId) => {
    console.log(`🗑️ Cancelando dispatch: ${dispatchId}`);

    try {
      // En Fase 1: simplemente dejar el dispatch en draft
      // En Fase 2: podríamos soft-delete o cambiar status a "cancelled"
      toast.success('Despacho cancelado');

    } catch (error) {
      console.error('❌ Error al cancelar dispatch:', error);
      toast.error('Error al cancelar el despacho');
      throw error;
    }
  };

  // =====================================================
  // RETURN
  // =====================================================

  return {
    // Estado
    warehouses,
    selectedWarehouse, // Del store de Zustand
    carriers,
    isLoading,
    isProcessing,

    // Métodos
    scanGuideForDispatch,
    confirmDispatch,
    cancelDispatch,
    loadInitialData
  };
}

export default useWMS;
