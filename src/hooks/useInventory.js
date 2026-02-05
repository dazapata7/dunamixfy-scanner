// =====================================================
// USE INVENTORY HOOK - Dunamix WMS
// =====================================================
// Hook para gestión de inventario
// Consulta de stock, búsqueda, movimientos
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { inventoryService, productsService } from '../services/wmsService';
import toast from 'react-hot-toast';

export function useInventory(warehouseId) {
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // =====================================================
  // LOAD STOCK
  // =====================================================

  const loadStock = useCallback(async (search = '') => {
    if (!warehouseId) {
      console.warn('⚠️ No hay warehouse seleccionado');
      return;
    }

    console.log(`📊 Cargando stock del almacén: ${warehouseId}`);
    setIsLoading(true);

    try {
      const stockData = await inventoryService.getAllStock(warehouseId, search);
      setStock(stockData);

      console.log(`✅ Stock cargado: ${stockData.length} productos`);

    } catch (error) {
      console.error('❌ Error al cargar stock:', error);
      toast.error('Error al cargar el inventario');
    } finally {
      setIsLoading(false);
    }
  }, [warehouseId]);

  // =====================================================
  // SEARCH
  // =====================================================

  const search = useCallback(async (term) => {
    setSearchTerm(term);
    await loadStock(term);
  }, [loadStock]);

  // =====================================================
  // GET PRODUCT STOCK
  // =====================================================

  /**
   * Obtener stock de un producto específico
   */
  const getProductStock = useCallback(async (productId) => {
    if (!warehouseId) {
      throw new Error('No hay warehouse seleccionado');
    }

    try {
      const stockData = await inventoryService.getStock(warehouseId, productId);
      return stockData;

    } catch (error) {
      console.error('❌ Error al consultar stock del producto:', error);
      throw error;
    }
  }, [warehouseId]);

  /**
   * Obtener stock por SKU
   */
  const getProductStockBySku = useCallback(async (sku) => {
    if (!warehouseId) {
      throw new Error('No hay warehouse seleccionado');
    }

    try {
      const stockData = await inventoryService.getStockBySku(warehouseId, sku);
      return stockData;

    } catch (error) {
      console.error('❌ Error al consultar stock del producto:', error);
      throw error;
    }
  }, [warehouseId]);

  // =====================================================
  // VALIDATE STOCK FOR DISPATCH
  // =====================================================

  /**
   * Validar stock para un despacho
   */
  const validateStockForDispatch = useCallback(async (items) => {
    if (!warehouseId) {
      throw new Error('No hay warehouse seleccionado');
    }

    try {
      const validation = await inventoryService.validateStock(warehouseId, items);
      return validation;

    } catch (error) {
      console.error('❌ Error al validar stock:', error);
      throw error;
    }
  }, [warehouseId]);

  // =====================================================
  // RELOAD
  // =====================================================

  const reload = useCallback(() => {
    loadStock(searchTerm);
  }, [loadStock, searchTerm]);

  // =====================================================
  // EFFECT: Cargar al montar o cambiar warehouse
  // =====================================================

  useEffect(() => {
    if (warehouseId) {
      loadStock();
    }
  }, [warehouseId]);

  // =====================================================
  // RETURN
  // =====================================================

  return {
    // Estado
    stock,
    isLoading,
    searchTerm,

    // Métodos
    loadStock,
    search,
    reload,
    getProductStock,
    getProductStockBySku,
    validateStockForDispatch
  };
}

export default useInventory;
