// =====================================================
// SCANNER CACHE HOOK - Dunamix WMS
// =====================================================
// Precarga productos + stock al abrir scanner
// Validaciones 100% locales (sin queries a BD)
// =====================================================

import { useState, useEffect } from 'react';
import { productsService, stockService, skuMappingsService } from '../services/wmsService';
import toast from 'react-hot-toast';

export function useScannerCache(warehouseId) {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [skuMappingsMap, setSkuMappingsMap] = useState({});

  useEffect(() => {
    if (!warehouseId) return;
    loadCache();
  }, [warehouseId]);

  async function loadCache() {
    setIsLoading(true);
    try {
      console.time('⚡ Cache Load Time');

      // Cargar en paralelo (más rápido)
      const [productsData, stockData, mappingsData] = await Promise.all([
        productsService.getAll(),
        stockService.getByWarehouse(warehouseId),
        skuMappingsService.getAll()
      ]);

      // Convertir stock a Map para O(1) lookup
      const stockMapData = {};
      stockData.forEach(s => {
        stockMapData[s.product_id] = s.qty_on_hand;
      });

      // Convertir SKU mappings a Map: source_sku -> product_id
      const mappingsMapData = {};
      mappingsData.forEach(m => {
        const key = `${m.source}_${m.external_sku.toUpperCase()}`;
        mappingsMapData[key] = m.product_id;
      });

      setProducts(productsData);
      setStockMap(stockMapData);
      setSkuMappingsMap(mappingsMapData);

      console.timeEnd('⚡ Cache Load Time');
      console.log(`✅ Cache cargado: ${productsData.length} productos, ${stockData.length} stocks, ${mappingsData.length} mappings`);

    } catch (error) {
      console.error('❌ Error al cargar cache:', error);
      toast.error('Error al cargar datos del scanner');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Buscar producto por SKU (cache local)
   * @param {string} sku - SKU a buscar
   * @param {string} source - Fuente (dunamixfy, interrapidisimo, etc)
   * @returns {object|null} - Producto encontrado o null
   */
  function findProductBySku(sku, source) {
    const skuUpper = sku.toUpperCase();

    // 1. Buscar en mappings externos
    const mappingKey = `${source}_${skuUpper}`;
    const productIdFromMapping = skuMappingsMap[mappingKey];

    if (productIdFromMapping) {
      const product = products.find(p => p.id === productIdFromMapping);
      if (product) {
        console.log(`✅ Producto encontrado via mapping: ${source}_${skuUpper} → ${product.name}`);
        return product;
      }
    }

    // 2. Fallback: Buscar por SKU directo
    const product = products.find(p => p.sku?.toUpperCase() === skuUpper);
    if (product) {
      console.log(`✅ Producto encontrado via SKU directo: ${skuUpper} → ${product.name}`);
      return product;
    }

    console.warn(`⚠️ No se encontró producto para SKU: ${skuUpper} (source: ${source})`);
    return null;
  }

  /**
   * Obtener stock disponible (cache local)
   * @param {string} productId - ID del producto
   * @returns {number} - Stock disponible
   */
  function getStock(productId) {
    return stockMap[productId] || 0;
  }

  /**
   * Validar si hay stock suficiente (cache local)
   * @param {string} productId - ID del producto
   * @param {number} qty - Cantidad requerida
   * @returns {boolean} - true si hay stock suficiente
   */
  function hasStock(productId, qty) {
    const available = stockMap[productId] || 0;
    return available >= qty;
  }

  /**
   * Actualizar stock local (optimistic update)
   * NOTA: Esto NO actualiza la BD, solo el cache local
   * @param {string} productId - ID del producto
   * @param {number} qty - Cantidad a descontar (negativo) o agregar (positivo)
   */
  function updateStockLocal(productId, qty) {
    setStockMap(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + qty
    }));
  }

  /**
   * Refrescar cache (útil después de confirmar batch)
   */
  async function refresh() {
    await loadCache();
  }

  return {
    isLoading,
    products,
    stockMap,
    findProductBySku,
    getStock,
    hasStock,
    updateStockLocal,
    refresh
  };
}
