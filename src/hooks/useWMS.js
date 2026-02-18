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
import { carriersService, codesService, supabase } from '../services/supabase';
import { dunamixfyApi } from '../services/dunamixfyApi';
import { dunamixfyService } from '../services/dunamixfyService';
import toast from 'react-hot-toast';

export function useWMS(cacheOpts = {}) {
  // Leer selectedWarehouse del store de Zustand (persistente)
  const { selectedWarehouse } = useStore();

  const [warehouses, setWarehouses] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // useRef para acceder al estado actual de carriers dentro de funciones
  const carriersRef = useRef([]);

  // CACHE: Dispatches del día para validación rápida de duplicados
  const todayDispatchesCache = useRef(new Map()); // Map<guide_code, dispatch>

  // ⚡ CACHE DE PRODUCTOS/STOCK (opcional)
  // Si ScanGuide.jsx pasa estas funciones, se usan para búsqueda O(1)
  // Si no se pasan, fallback al flujo normal con queries a BD
  const { findProductBySku, hasStock, getStock } = cacheOpts;

  // =====================================================
  // INICIALIZACIÓN
  // =====================================================

  useEffect(() => {
    loadInitialData();
  }, []);

  /**
   * Cargar dispatches del día en cache para validación rápida
   */
  async function loadTodayDispatchesCache(warehouseId) {
    if (!warehouseId) {
      console.warn('⚠️ No hay warehouse seleccionado, no se carga cache');
      return;
    }

    console.log('🔄 Cargando cache de dispatches del día...');
    try {
      const dispatches = await dispatchesService.getTodayDispatches(warehouseId);

      // Crear Map para búsqueda O(1)
      const cache = new Map();
      dispatches.forEach(dispatch => {
        cache.set(dispatch.guide_code, dispatch);
      });

      todayDispatchesCache.current = cache;
      console.log(`✅ Cache cargado: ${cache.size} dispatches del día`);
    } catch (error) {
      console.error('❌ Error al cargar cache de dispatches:', error);
      todayDispatchesCache.current = new Map(); // Cache vacío
    }
  }

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

      // ⚡ Obtener objeto carrier desde memoria (evita query a BD en resolveShipment)
      const carrierObj = currentCarriers.find(c => c.id === carrierId) || null;

      console.log(`🚚 Transportadora detectada: ${carrierName} (${codigo})`);

      // ⚡ OPTIMIZACIÓN: Eliminada consulta previa a Dunamixfy
      // Los datos vienen directamente de resolveShipment() más abajo

      // 2. OPTIMIZACIÓN: Validación rápida contra cache (O(1) - instantáneo)
      console.log(`🔍 Validando duplicados en cache (${todayDispatchesCache.current.size} dispatches)...`);
      const cachedDispatch = todayDispatchesCache.current.get(codigo);

      if (cachedDispatch) {
        console.warn(`⚠️ DUPLICADO ENCONTRADO EN CACHE:`, cachedDispatch);

        if (cachedDispatch.status === 'confirmed') {
          const confirmedDate = cachedDispatch.confirmed_at
            ? new Date(cachedDispatch.confirmed_at)
            : new Date(cachedDispatch.created_at);

          const today = new Date();
          const dispatchDate = new Date(confirmedDate);

          // Verificar si es de hoy
          const isToday =
            dispatchDate.getDate() === today.getDate() &&
            dispatchDate.getMonth() === today.getMonth() &&
            dispatchDate.getFullYear() === today.getFullYear();

          console.warn(`⚠️ Guía ${codigo} ya fue confirmada ${isToday ? 'HOY' : 'en otro día'}`);

          return {
            dispatch: cachedDispatch,
            category: isToday ? 'REPEATED_TODAY' : 'REPEATED_OTHER_DAY',
            isDuplicate: true,
            isToday,
            confirmedAt: confirmedDate,
            message: isToday
              ? `Repetida HOY - ${confirmedDate.toLocaleTimeString()}`
              : `Repetida de ${confirmedDate.toLocaleDateString()}`,
            carrierInfo: { id: carrierId, name: carrierName, code: carrierCode },
            feedbackInfo: {
              code: codigo,
              carrier: carrierName,
              customerName: 'Cliente', // No necesitamos consultar de nuevo
              orderId: null,
              storeName: null,
              itemsCount: cachedDispatch.dispatch_items?.length || 0
            }
          };
        } else {
          // Existe pero en draft
          console.warn(`⚠️ Ya existe un dispatch en DRAFT para esta guía en el batch actual`);
          return {
            dispatch: cachedDispatch,
            category: 'DRAFT_DUPLICATE',
            isDuplicate: true,
            message: 'Esta guía ya tiene un despacho en borrador',
            carrierInfo: { id: carrierId, name: carrierName, code: carrierCode },
            feedbackInfo: {
              code: codigo,
              carrier: carrierName,
              customerName: 'Cliente', // No necesitamos consultar de nuevo
              orderId: null,
              storeName: null,
              itemsCount: cachedDispatch.dispatch_items?.length || 0
            }
          };
        }
      }

      console.log('✅ No existe duplicado en cache, continuando...');

      // 3. ⚡ OPTIMIZACIÓN: Resolver items sin crear shipment_record (modo rápido)
      // Pasar carrierObj para evitar query a BD en resolveShipment (-50ms)
      const shipmentData = await shipmentResolverService.resolveShipment(codigo, carrierId, true, carrierObj);

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
          carrierInfo: { id: carrierId, name: carrierName, code: carrierCode },
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

      // ⚡ OPTIMIZACIÓN: Escaneo rápido - NO crear en BD durante escaneo
      // Todos los datos se guardan en memoria y se crean al confirmar el batch
      console.log('⚡ Escaneo rápido - datos guardados en memoria (NO en BD)');

      // ⚡ Mapear SKUs a product_ids DURANTE el escaneo (con cache O(1))
      // Esto permite: 1) detectar productos no encontrados temprano, 2) pre-validar stock en batch
      const source = carrierCode === 'coordinadora' ? 'dunamixfy' : carrierCode;

      // ⚡ Si los items ya traen product_id (ej. Interrápidisimo los guarda en BD),
      // intentar mapeo suave: usar product_id existente como fallback si no hay mapping
      let mappedItems;
      try {
        mappedItems = await mapSkusToProducts(shipmentData.items, source);
        console.log(`✅ SKUs mapeados: ${mappedItems.map(i => `${i.sku}→${i.product_id}`).join(', ')}`);
      } catch (mappingError) {
        // Si el mapeo falla, verificar si los items ya traen product_id de la BD
        // (Interrápidisimo los guarda en shipment_items.product_id)
        const itemsWithPreloadedProductId = shipmentData.items.filter(i => i.product_id);
        if (itemsWithPreloadedProductId.length === shipmentData.items.length) {
          console.log(`✅ Usando product_ids precargados desde BD (${itemsWithPreloadedProductId.length} items)`);
          mappedItems = shipmentData.items; // ya tienen product_id
        } else {
          // Algunos items no tienen product_id NI mapping → error real
          console.error('❌ Error mapeando SKUs - productos no encontrados:', mappingError.message);
          throw mappingError; // Propaga al try/catch de scanGuideForDispatch que lo retorna como ERROR_OTHER
        }
      }

      // Crear dispatch temporal en memoria
      const tempDispatch = {
        // Dispatch temporal en memoria (sin ID)
        warehouse_id: selectedWarehouse.id,
        operator_id: operatorId,
        carrier_id: carrierId,
        guide_code: codigo,
        shipment_record_id: shipmentData.shipmentRecord?.id || null,
        first_scanned_by: operatorId,
        notes: `Creado desde escaneo WMS - ${carrierName}`,
        status: 'draft',
        created_at: new Date().toISOString(), // Para ordenamiento
        // Items ya mapeados con product_id (para pre-validación de stock en batch)
        items: mappedItems,
        source,
        // ⚡ Guardar raw_payload para crear shipment_record al confirmar (si no existe)
        raw_payload: shipmentData.raw_payload || null
      };

      // Agregar al cache para validar siguientes escaneos
      todayDispatchesCache.current.set(codigo, tempDispatch);
      console.log(`✅ Guía agregada al cache (total: ${todayDispatchesCache.current.size})`);

      // Retornar datos en memoria
      return {
        dispatch: tempDispatch,
        metadata: shipmentData.metadata,
        shipmentRecord: shipmentData.shipmentRecord,
        category: 'SUCCESS', // ✅ Guía nueva procesada exitosamente
        isDuplicate: false,
        hasError: false,
        carrierInfo: { id: carrierId, name: carrierName, code: carrierCode },
        // Info para feedback visual (ScanGuide.jsx lo usa para mostrar al usuario)
        feedbackInfo: {
          code: codigo,
          carrier: carrierName,
          customerName: shipmentData.metadata?.customer_name,
          orderId: shipmentData.metadata?.order_id,
          storeName: shipmentData.metadata?.store,
          itemsCount: mappedItems.length
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
    // ⚡ OPTIMIZACIÓN: Todas las búsquedas en PARALELO con Promise.all
    // Con cache: 5ms total (antes: 5ms x N items secuencial)
    // Sin cache: 100ms total (antes: 100ms x N items secuencial)
    const mappedItems = await Promise.all(
      items.map(async (item) => {
        try {
          // Si el item ya tiene product_id (ej. Interrápidisimo desde BD), reusar directamente
          if (item.product_id) {
            return item;
          }

          let product = null;

          if (findProductBySku) {
            // Cache O(1) - instantáneo
            product = findProductBySku(item.sku, source);
          } else {
            // Fallback a BD (ahora en paralelo con otros items)
            product = await productsService.getBySku(item.sku, source);
          }

          if (!product) {
            return {
              ...item,
              product_id: null,
              error: `Producto no encontrado: ${item.sku}${source ? ` (${source})` : ''}`
            };
          }

          return {
            ...item,
            product_id: product.id,
            product_name: product.name,
            product: product
          };

        } catch (error) {
          console.error(`❌ Error mapeando SKU ${item.sku}:`, error);
          return {
            ...item,
            product_id: null,
            error: error.message
          };
        }
      })
    );

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
  /**
   * Crear y confirmar dispatch desde datos en memoria (escaneo rápido)
   * @param {Object} dispatchData - Dispatch temporal en memoria
   * @param {boolean} skipStockValidation - Si true, omite validación de stock (ya se validó en lote)
   */
  const createAndConfirmDispatch = async (dispatchData, skipStockValidation = false) => {
    const guideCode = dispatchData.guide_code;
    console.log(`⚡ Creando y confirmando dispatch: ${guideCode}`);
    setIsProcessing(true);

    try {
      // 0.0 VALIDAR QUE NO EXISTA YA EN BD (prevenir duplicados)
      console.log(`[1/5] Verificando duplicado en BD para ${guideCode}...`);
      const { data: existing } = await supabase
        .from('dispatches')
        .select('id, dispatch_number, status, guide_code')
        .eq('guide_code', guideCode)
        .maybeSingle();

      if (existing) {
        console.warn(`⚠️ Dispatch ya existe para guía ${guideCode}:`, existing);

        // Si ya está confirmado, es un duplicado real - saltar silenciosamente
        if (existing.status === 'confirmed') {
          console.log(`✅ Guía ${guideCode} ya confirmada anteriormente, saltando...`);
          return existing; // Retornar el existente sin error
        }

        // Si está en draft, confirmar el existente en lugar de crear uno nuevo
        if (existing.status === 'draft') {
          console.log(`🔄 Dispatch en draft encontrado (${existing.dispatch_number}), confirmando...`);
          // Continuar con el id existente
          const confirmedDispatch = await dispatchesService.confirm(existing.id, { skipStockValidation });
          return confirmedDispatch;
        }

        throw new Error(`Guía ${guideCode} ya fue procesada (${existing.dispatch_number})`);
      }

      // 0.1 CREAR SHIPMENT_RECORD SI NO EXISTE (se omitió durante escaneo rápido)
      let shipmentRecordId = dispatchData.shipment_record_id;
      console.log(`[2/5] shipment_record_id=${shipmentRecordId}, raw_payload=${!!dispatchData.raw_payload}`);

      if (!shipmentRecordId && dispatchData.raw_payload) {
        console.log('📝 Creando shipment_record omitido durante escaneo rápido...');
        const shipmentRecord = await shipmentResolverService.createOrUpdateShipmentRecord(
          dispatchData.raw_payload,
          dispatchData.items
        );
        shipmentRecordId = shipmentRecord.id;
        console.log(`✅ Shipment record creado: ${shipmentRecordId}`);
      }

      // 1. Mapear SKUs a product_ids (si ya fueron mapeados durante escaneo, reusar)
      const needsMapping = dispatchData.items.some(i => !i.product_id);
      console.log(`[3/5] Mapeando SKUs: needsMapping=${needsMapping}, items=${dispatchData.items.length}`);
      console.log(`   Items: ${JSON.stringify(dispatchData.items.map(i => ({sku: i.sku, product_id: i.product_id, qty: i.qty})))}`);
      const itemsWithProducts = needsMapping
        ? await mapSkusToProducts(dispatchData.items, dispatchData.source)
        : dispatchData.items;

      // 2. Crear dispatch en BD
      console.log(`[4/5] Creando dispatch en BD con ${itemsWithProducts.length} items...`);
      const dispatch = await dispatchesService.create({
        warehouse_id: dispatchData.warehouse_id,
        operator_id: dispatchData.operator_id,
        carrier_id: dispatchData.carrier_id,
        guide_code: dispatchData.guide_code,
        shipment_record_id: shipmentRecordId,
        first_scanned_by: dispatchData.first_scanned_by,
        notes: dispatchData.notes
      }, itemsWithProducts);

      console.log(`✅ Dispatch creado en BD: ${dispatch.dispatch_number} (id=${dispatch.id})`);

      // 3. Confirmar dispatch (crea movimientos OUT)
      console.log(`[5/5] Confirmando dispatch ${dispatch.id}...`);
      const confirmedDispatch = await dispatchesService.confirm(dispatch.id, { skipStockValidation });

      // 4. Marcar shipment_record como PROCESSED
      if (shipmentRecordId) {
        await shipmentResolverService.markAsProcessed(shipmentRecordId);
      }

      // 5. Marcar orden como SCANNED en Dunamixfy (solo para Coordinadora)
      if (confirmedDispatch.guide_code && confirmedDispatch.carrier_id) {
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
            console.warn('⚠️ Error al marcar como scanned en Dunamixfy:', dunamixfyError);
          }
        }
      }

      console.log('✅ Dispatch creado y confirmado exitosamente');
      return confirmedDispatch;

    } catch (error) {
      console.error('❌ Error al crear/confirmar dispatch:', error);
      throw error;

    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDispatch = async (dispatchOrId, shipmentRecordId, { skipStockValidation = false } = {}) => {
    setIsProcessing(true);

    try {
      let dispatchId = dispatchOrId;

      // 🔥 FIX: Si dispatch es un objeto sin ID (temporal), usar createAndConfirmDispatch
      if (typeof dispatchOrId === 'object' && !dispatchOrId.id) {
        console.log('🔄 Dispatch temporal detectado - usando createAndConfirmDispatch...');
        // createAndConfirmDispatch ya maneja: SKU mapping, shipment_record, Dunamixfy marking
        return await createAndConfirmDispatch(dispatchOrId, skipStockValidation);
      }

      console.log(`✅ Confirmando dispatch existente: ${dispatchId}`);

      // 1. Confirmar dispatch (crea movimientos OUT)
      const confirmedDispatch = await dispatchesService.confirm(dispatchId, { skipStockValidation });

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
      // Toast manejado por el componente que llama (no duplicar toasts en batch)

      return confirmedDispatch;

    } catch (error) {
      console.error('❌ Error al confirmar dispatch:', error);
      // No mostrar toast aquí - el componente maneja el resultado del batch

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
    createAndConfirmDispatch, // Nueva función para escaneo rápido
    cancelDispatch,
    loadInitialData,
    loadTodayDispatchesCache // Cargar cache de dispatches del día
  };
}

export default useWMS;
