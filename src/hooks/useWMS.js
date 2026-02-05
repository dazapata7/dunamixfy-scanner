// =====================================================
// USE WMS HOOK - Dunamix Scanner
// =====================================================
// Hook principal para funcionalidad WMS
// Maneja: warehouses, scan guide, dispatch, validación
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { warehousesService, dispatchesService } from '../services/wmsService';
import { shipmentResolverService } from '../services/shipmentResolverService';
import { inventoryService, productsService } from '../services/wmsService';
import { procesarCodigoConCarriers } from '../utils/validators';
import { carriersService } from '../services/supabase';
import toast from 'react-hot-toast';

export function useWMS() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [carriers, setCarriers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
   */
  const scanGuideForDispatch = useCallback(async (rawCode, operatorId) => {
    if (!selectedWarehouse) {
      throw new Error('Debe seleccionar un almacén primero');
    }

    if (!operatorId) {
      throw new Error('Operador no identificado');
    }

    console.log('🔍 WMS: Procesando guía:', rawCode);
    setIsProcessing(true);

    try {
      // 1. Detectar transportadora
      const detectionResult = procesarCodigoConCarriers(rawCode, carriers);

      if (!detectionResult.valido) {
        throw new Error('Código no válido para ninguna transportadora');
      }

      const { codigo, carrierId, carrierName, carrierCode } = detectionResult;

      console.log(`🚚 Transportadora detectada: ${carrierName} (${codigo})`);

      // 2. Verificar idempotencia (que no exista dispatch con esta guía)
      const existingDispatch = await dispatchesService.getByGuideCode(codigo);

      if (existingDispatch) {
        if (existingDispatch.status === 'confirmed') {
          throw new Error(`Esta guía ya fue despachada el ${new Date(existingDispatch.confirmed_at).toLocaleString()}`);
        } else {
          // Existe pero en draft, podríamos reutilizarlo o mostrar advertencia
          console.warn('⚠️ Ya existe un dispatch en draft para esta guía');
          return {
            dispatch: existingDispatch,
            isDuplicate: true,
            message: 'Esta guía ya tiene un despacho en borrador'
          };
        }
      }

      // 3. Resolver items del envío según transportadora
      const shipmentData = await shipmentResolverService.resolveShipment(codigo, carrierId);

      console.log(`📦 Items resueltos: ${shipmentData.items.length} productos`);

      // 4. Mapear SKUs a product_ids
      const itemsWithProducts = await this.mapSkusToProducts(shipmentData.items);

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

      // Retornar dispatch + metadata + validación stock
      return {
        dispatch,
        metadata: shipmentData.metadata,
        stockValidation,
        shipmentRecord: shipmentData.shipmentRecord,
        isDuplicate: false
      };

    } catch (error) {
      console.error('❌ Error al procesar guía:', error);
      toast.error(error.message || 'Error al procesar la guía');
      throw error;

    } finally {
      setIsProcessing(false);
    }
  }, [selectedWarehouse, carriers]);

  /**
   * Mapear SKUs a product_ids
   * Si el producto no existe, retorna error en el item
   */
  async function mapSkusToProducts(items) {
    const mappedItems = [];

    for (const item of items) {
      try {
        // Buscar producto por SKU
        const product = await productsService.getBySku(item.sku);

        if (!product) {
          // Producto no encontrado
          mappedItems.push({
            ...item,
            product_id: null,
            error: `Producto no encontrado: ${item.sku}`
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
  const confirmDispatch = useCallback(async (dispatchId, shipmentRecordId) => {
    console.log(`✅ Confirmando dispatch: ${dispatchId}`);
    setIsProcessing(true);

    try {
      // 1. Confirmar dispatch (crea movimientos OUT)
      const confirmedDispatch = await dispatchesService.confirm(dispatchId);

      // 2. Marcar shipment_record como PROCESSED
      if (shipmentRecordId) {
        await shipmentResolverService.markAsProcessed(shipmentRecordId);
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
  }, []);

  // =====================================================
  // CANCEL DISPATCH
  // =====================================================

  /**
   * Cancelar/eliminar dispatch en draft
   */
  const cancelDispatch = useCallback(async (dispatchId) => {
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
  }, []);

  // =====================================================
  // WAREHOUSE SELECTION
  // =====================================================

  const selectWarehouse = useCallback((warehouse) => {
    console.log(`📍 Almacén seleccionado: ${warehouse.name}`);
    setSelectedWarehouse(warehouse);
    toast.success(`Almacén: ${warehouse.name}`);
  }, []);

  const clearWarehouse = useCallback(() => {
    console.log('📍 Almacén des-seleccionado');
    setSelectedWarehouse(null);
  }, []);

  // =====================================================
  // RETURN
  // =====================================================

  return {
    // Estado
    warehouses,
    selectedWarehouse,
    carriers,
    isLoading,
    isProcessing,

    // Métodos
    selectWarehouse,
    clearWarehouse,
    scanGuideForDispatch,
    confirmDispatch,
    cancelDispatch,
    loadInitialData
  };
}

export default useWMS;
