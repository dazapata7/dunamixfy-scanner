// =====================================================
// WMS SERVICE - Dunamix Scanner
// =====================================================
// Servicios CRUD para módulo WMS (Warehouse Management System)
// Incluye: warehouses, products, inventory, receipts, dispatches
// =====================================================

import { supabase } from './supabase';

// =====================================================
// WAREHOUSES SERVICE (Almacenes)
// =====================================================

export const warehousesService = {
  /**
   * Obtener todos los almacenes activos
   */
  async getAll() {
    console.log('📦 WMS: Cargando almacenes...');

    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('❌ Error al cargar almacenes:', error);
      throw error;
    }

    console.log(`✅ ${data.length} almacenes cargados`);
    return data;
  },

  /**
   * Obtener almacén por código
   */
  async getByCode(code) {
    console.log(`🔍 Buscando almacén con código: ${code}`);

    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️ Almacén no encontrado');
        return null;
      }
      console.error('❌ Error al buscar almacén:', error);
      throw error;
    }

    console.log(`✅ Almacén encontrado: ${data.name}`);
    return data;
  },

  /**
   * Obtener almacén por ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Crear nuevo almacén
   */
  async create(warehouseData) {
    console.log('📦 Creando almacén:', warehouseData.name);

    const { data, error } = await supabase
      .from('warehouses')
      .insert([warehouseData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear almacén:', error);
      throw error;
    }

    console.log('✅ Almacén creado exitosamente');
    return data;
  },

  /**
   * Actualizar almacén
   */
  async update(id, updates) {
    console.log('📝 Actualizando almacén:', id);

    const { data, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ Error al actualizar almacén:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error('Almacén no encontrado');
    }

    console.log('✅ Almacén actualizado');
    return data[0];
  },

  /**
   * Soft delete: desactivar almacén
   */
  async deactivate(id) {
    return this.update(id, { is_active: false });
  },

  /**
   * Hard delete: eliminar almacén (solo si no tiene inventario)
   */
  async delete(id) {
    console.log(`🗑️ Eliminando almacén ID: ${id}`);

    // Verificar inventory_movements
    console.log('🔍 Verificando relaciones en inventory_movements...');
    const { data: movements, error: checkError1 } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('warehouse_id', id)
      .limit(1);

    if (checkError1) {
      console.error('❌ Error al verificar inventory_movements:', checkError1);
      throw checkError1;
    }

    if (movements && movements.length > 0) {
      console.warn(`⚠️ Almacén tiene ${movements.length} movimientos de inventario`);
      throw new Error('No se puede eliminar: almacén tiene movimientos de inventario');
    }
    console.log('✅ Sin movimientos de inventario');

    // Verificar receipts
    console.log('🔍 Verificando relaciones en receipts...');
    const { data: receipts, error: checkError2 } = await supabase
      .from('receipts')
      .select('id')
      .eq('warehouse_id', id)
      .limit(1);

    if (checkError2) {
      console.error('❌ Error al verificar receipts:', checkError2);
      throw checkError2;
    }

    if (receipts && receipts.length > 0) {
      console.warn(`⚠️ Almacén tiene ${receipts.length} recibos`);
      throw new Error('No se puede eliminar: almacén tiene recibos registrados');
    }
    console.log('✅ Sin recibos');

    // Verificar dispatches
    console.log('🔍 Verificando relaciones en dispatches...');
    const { data: dispatches, error: checkError3 } = await supabase
      .from('dispatches')
      .select('id')
      .eq('warehouse_id', id)
      .limit(1);

    if (checkError3) {
      console.error('❌ Error al verificar dispatches:', checkError3);
      throw checkError3;
    }

    if (dispatches && dispatches.length > 0) {
      console.warn(`⚠️ Almacén tiene ${dispatches.length} despachos`);
      throw new Error('No se puede eliminar: almacén tiene despachos registrados');
    }
    console.log('✅ Sin despachos');

    console.log(`✅ Almacén ${id} sin relaciones - procediendo a eliminar`);

    // Eliminar físicamente de la BD
    const { data, error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ Error al eliminar almacén de BD:', error);
      console.error('   Código:', error.code);
      console.error('   Mensaje:', error.message);
      console.error('   Detalles:', error.details);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('❌ DELETE no retornó datos - almacén podría no haberse eliminado');
      throw new Error('Error al eliminar: no se obtuvo confirmación de la base de datos');
    }

    console.log(`✅ Almacén eliminado correctamente de BD:`, data);
    return data;
  }
};

// =====================================================
// PRODUCTS SERVICE (Productos)
// =====================================================

export const productsService = {
  /**
   * Obtener todos los productos activos
   */
  async getAll() {
    console.log('📦 WMS: Cargando productos...');

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sku');

    if (error) {
      console.error('❌ Error al cargar productos:', error);
      throw error;
    }

    console.log(`✅ ${data.length} productos cargados`);
    return data;
  },

  /**
   * Buscar producto por SKU (interno o externo con mapping)
   * @param {string} sku - SKU a buscar
   * @param {string} source - Fuente del SKU externo ('dunamixfy', 'interrapidisimo', etc.)
   */
  async getBySku(sku, source = null) {
    console.log(`🔍 Buscando producto con SKU: ${sku}${source ? ` (source: ${source})` : ''}`);

    // 1. Si hay source, buscar primero en mappings
    if (source) {
      const { data: mapping, error: mappingError } = await supabase
        .from('product_sku_mappings')
        .select('product_id, products(*)')
        .eq('source', source)
        .eq('external_sku', sku)
        .eq('is_active', true)
        .single();

      if (!mappingError && mapping) {
        console.log(`✅ Producto encontrado vía mapping (${source}): ${mapping.products.name}`);
        return mapping.products;
      }

      if (mappingError && mappingError.code !== 'PGRST116') {
        console.error('❌ Error al buscar mapping:', mappingError);
      } else {
        console.log(`⚠️ No se encontró mapping para SKU externo: ${sku} (${source})`);
      }
    }

    // 2. Buscar por SKU interno (fallback)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('sku', sku)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️ Producto no encontrado');
        return null;
      }
      console.error('❌ Error al buscar producto:', error);
      throw error;
    }

    console.log(`✅ Producto encontrado por SKU interno: ${data.name}`);
    return data;
  },

  /**
   * Buscar producto por código de barras
   */
  async getByBarcode(barcode) {
    console.log(`🔍 Buscando producto con barcode: ${barcode}`);

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️ Producto no encontrado');
        return null;
      }
      console.error('❌ Error al buscar producto:', error);
      throw error;
    }

    console.log(`✅ Producto encontrado: ${data.name}`);
    return data;
  },

  /**
   * Obtener producto por ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Crear nuevo producto
   */
  async create(productData) {
    console.log('📦 Creando producto:', productData.name);

    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear producto:', error);
      throw error;
    }

    console.log('✅ Producto creado exitosamente');
    return data;
  },

  /**
   * Actualizar producto
   */
  async update(id, updates) {
    console.log('📝 Actualizando producto:', id);

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ Error al actualizar producto:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error('Producto no encontrado');
    }

    console.log('✅ Producto actualizado');
    return data[0];
  },

  /**
   * Soft delete: desactivar producto
   */
  async deactivate(id) {
    return this.update(id, { is_active: false });
  },

  /**
   * Hard delete: eliminar producto (solo si no tiene movimientos de inventario)
   */
  async delete(id) {
    console.log(`🗑️ Eliminando producto ID: ${id}`);

    // Verificar todas las tablas que pueden tener referencias
    console.log('🔍 Verificando relaciones en inventory_movements...');
    const { data: movements, error: checkError1 } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (checkError1) {
      console.error('❌ Error al verificar inventory_movements:', checkError1);
      throw checkError1;
    }

    if (movements && movements.length > 0) {
      console.warn(`⚠️ Producto tiene ${movements.length} movimientos de inventario`);
      throw new Error('No se puede eliminar: producto tiene movimientos de inventario');
    }
    console.log('✅ Sin movimientos de inventario');

    // Verificar receipt_items
    console.log('🔍 Verificando relaciones en receipt_items...');
    const { data: receiptItems, error: checkError2 } = await supabase
      .from('receipt_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (checkError2) {
      console.error('❌ Error al verificar receipt_items:', checkError2);
      throw checkError2;
    }

    if (receiptItems && receiptItems.length > 0) {
      console.warn(`⚠️ Producto tiene ${receiptItems.length} items en recibos`);
      throw new Error('No se puede eliminar: producto tiene items en recibos');
    }
    console.log('✅ Sin items en recibos');

    // Verificar dispatch_items
    console.log('🔍 Verificando relaciones en dispatch_items...');
    const { data: dispatchItems, error: checkError3 } = await supabase
      .from('dispatch_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (checkError3) {
      console.error('❌ Error al verificar dispatch_items:', checkError3);
      throw checkError3;
    }

    if (dispatchItems && dispatchItems.length > 0) {
      console.warn(`⚠️ Producto tiene ${dispatchItems.length} items en despachos`);
      throw new Error('No se puede eliminar: producto tiene items en despachos');
    }
    console.log('✅ Sin items en despachos');

    // Verificar shipment_items
    console.log('🔍 Verificando relaciones en shipment_items...');
    const { data: shipmentItems, error: checkError4 } = await supabase
      .from('shipment_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (checkError4) {
      console.error('❌ Error al verificar shipment_items:', checkError4);
      throw checkError4;
    }

    if (shipmentItems && shipmentItems.length > 0) {
      console.warn(`⚠️ Producto tiene ${shipmentItems.length} items en envíos`);
      throw new Error('No se puede eliminar: producto tiene items en envíos importados');
    }
    console.log('✅ Sin items en envíos');

    console.log(`✅ Producto ${id} sin relaciones - procediendo a eliminar`);

    // Eliminar físicamente de la BD
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ Error al eliminar producto de BD:', error);
      console.error('   Código:', error.code);
      console.error('   Mensaje:', error.message);
      console.error('   Detalles:', error.details);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('❌ DELETE no retornó datos - producto podría no haberse eliminado');
      throw new Error('Error al eliminar: no se obtuvo confirmación de la base de datos');
    }

    console.log(`✅ Producto eliminado correctamente de BD:`, data);
    return data;
  },

  /**
   * Buscar productos (por SKU o nombre)
   */
  async search(searchTerm) {
    console.log(`🔍 Buscando productos: "${searchTerm}"`);

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,barcode.eq.${searchTerm}`)
      .order('sku')
      .limit(20);

    if (error) {
      console.error('❌ Error en búsqueda:', error);
      throw error;
    }

    console.log(`✅ ${data.length} productos encontrados`);
    return data;
  }
};

// =====================================================
// INVENTORY SERVICE (Stock y Movimientos)
// =====================================================

export const inventoryService = {
  /**
   * Obtener stock de un producto en un almacén
   */
  async getStock(warehouseId, productId) {
    console.log(`📊 Consultando stock: producto ${productId} en almacén ${warehouseId}`);

    const { data, error } = await supabase
      .from('inventory_stock_view')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No existe aún, retornar stock 0
        return { qty_on_hand: 0 };
      }
      console.error('❌ Error al consultar stock:', error);
      throw error;
    }

    console.log(`✅ Stock: ${data.qty_on_hand} unidades`);
    return data;
  },

  /**
   * Obtener stock por SKU
   */
  async getStockBySku(warehouseId, sku) {
    console.log(`📊 Consultando stock: SKU ${sku} en almacén ${warehouseId}`);

    const { data, error } = await supabase
      .from('inventory_stock_view')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('sku', sku)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { sku, qty_on_hand: 0 };
      }
      console.error('❌ Error al consultar stock:', error);
      throw error;
    }

    console.log(`✅ Stock ${sku}: ${data.qty_on_hand} unidades`);
    return data;
  },

  /**
   * Obtener todo el stock de un almacén
   */
  async getAllStock(warehouseId, searchTerm = '') {
    console.log(`📊 Consultando inventario del almacén: ${warehouseId}`);

    let query = supabase
      .from('inventory_stock_view')
      .select('*')
      .eq('warehouse_id', warehouseId);

    if (searchTerm) {
      query = query.or(`sku.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query.order('sku');

    if (error) {
      console.error('❌ Error al consultar inventario:', error);
      throw error;
    }

    // Calcular capacidad estimada para combos
    // Para cada combo: floor(stock_componente / qty_requerida) → mínimo entre todos los componentes
    const combos = data.filter(item => item.type === 'combo');

    if (combos.length > 0) {
      // Obtener componentes de todos los combos en una sola query
      const comboIds = combos.map(c => c.product_id);
      const { data: components } = await supabase
        .from('product_combo_components')
        .select('combo_product_id, component_product_id, quantity')
        .in('combo_product_id', comboIds);

      if (components && components.length > 0) {
        // Construir mapa: product_id → qty_on_hand (para búsqueda O(1))
        const stockMap = new Map(data.map(item => [item.product_id, item.qty_on_hand]));

        // Para cada combo, calcular capacidad estimada
        data.forEach(item => {
          if (!comboIds.includes(item.product_id)) return;

          const comboComponents = components.filter(c => c.combo_product_id === item.product_id);
          if (comboComponents.length === 0) {
            item.estimated_capacity = 0;
            item.is_combo = true;
            return;
          }

          // Capacidad = mínimo de floor(stock / qty_requerida) entre todos los componentes
          const capacity = Math.min(
            ...comboComponents.map(c => {
              const componentStock = stockMap.get(c.component_product_id) ?? 0;
              return Math.floor(componentStock / c.quantity);
            })
          );

          item.estimated_capacity = capacity;
          item.is_combo = true;
          item.combo_components = comboComponents.map(c => ({
            product_id: c.component_product_id,
            qty_required: c.quantity,
            stock_available: stockMap.get(c.component_product_id) ?? 0
          }));
        });
      }
    }

    console.log(`✅ ${data.length} productos en inventario`);
    return data;
  },

  /**
   * Validar stock antes de despacho
   * Retorna: { valid: boolean, results: [...] }
   */
  async validateStock(warehouseId, items) {
    console.log(`🔍 Validando stock para ${items.length} items...`);

    const results = [];

    for (const item of items) {
      try {
        // Buscar producto por SKU si no tiene product_id
        let productId = item.product_id;
        if (!productId && item.sku) {
          const product = await productsService.getBySku(item.sku);
          if (!product) {
            results.push({
              sku: item.sku,
              product_id: null,
              requested: item.qty,
              available: 0,
              insufficient: true,
              error: 'Producto no encontrado'
            });
            continue;
          }
          productId = product.id;
        }

        // Consultar stock
        const stock = await this.getStock(warehouseId, productId);

        const insufficient = stock.qty_on_hand < item.qty;

        results.push({
          sku: item.sku || stock.sku,
          product_id: productId,
          product_name: stock.product_name,
          requested: item.qty,
          available: stock.qty_on_hand,
          insufficient
        });

      } catch (error) {
        console.error(`❌ Error validando item ${item.sku}:`, error);
        results.push({
          sku: item.sku,
          requested: item.qty,
          available: 0,
          insufficient: true,
          error: error.message
        });
      }
    }

    const hasErrors = results.some(r => r.insufficient);

    if (hasErrors) {
      console.warn('⚠️ Stock insuficiente para algunos items:');
      results.filter(r => r.insufficient).forEach(r => {
        console.warn(`  - ${r.sku}: necesita ${r.requested}, disponible ${r.available}`);
      });
    } else {
      console.log('✅ Stock suficiente para todos los items');
    }

    return { valid: !hasErrors, results };
  },

  /**
   * Validar stock para un lote completo de items (agregados)
   * Suma todas las cantidades por producto antes de validar,
   * evitando el problema de validaciones secuenciales que depletan el stock
   * @param {string} warehouseId
   * @param {Array} allItems - Array de {product_id, qty} de TODOS los dispatches del batch
   */
  async validateBatchStock(warehouseId, allItems) {
    console.log(`🔍 Validando stock para batch: ${allItems.length} items totales...`);

    // Agregar cantidades por product_id
    const aggregated = new Map();
    for (const item of allItems) {
      if (!item.product_id) continue;
      const existing = aggregated.get(item.product_id);
      if (existing) {
        existing.qty += item.qty;
      } else {
        aggregated.set(item.product_id, { product_id: item.product_id, sku: item.sku, qty: item.qty });
      }
    }

    const aggregatedItems = Array.from(aggregated.values());
    console.log(`📊 ${aggregatedItems.length} productos únicos en el batch`);

    // Validar stock total para cada producto único
    return await this.validateStock(warehouseId, aggregatedItems);
  },

  /**
   * Crear movimiento de inventario
   */
  async createMovement(movementData) {
    console.log(`📦 Creando movimiento ${movementData.movement_type}:`, movementData);

    const { data, error } = await supabase
      .from('inventory_movements')
      .insert([movementData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear movimiento:', error);
      throw error;
    }

    console.log('✅ Movimiento creado exitosamente');
    return data;
  },

  /**
   * Obtener movimientos de un producto
   */
  async getMovements(warehouseId, productId, limit = 50) {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
};

// =====================================================
// RECEIPTS SERVICE (Entradas de Inventario)
// =====================================================

export const receiptsService = {
  /**
   * Crear recibo (draft)
   */
  async create(receiptData, items) {
    console.log('📥 Creando recibo de entrada...');

    try {
      // 1. Generar número de recibo
      const { data: receiptNumber, error: fnError } = await supabase
        .rpc('generate_receipt_number');

      if (fnError) throw fnError;

      // 2. Crear recibo
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert([{
          ...receiptData,
          receipt_number: receiptNumber,
          status: 'draft'
        }])
        .select()
        .single();

      if (receiptError) throw receiptError;

      // 3. Crear items
      const itemsToInsert = items.map(item => ({
        receipt_id: receipt.id,
        product_id: item.product_id,
        qty: item.qty,
        notes: item.notes
      }));

      const { data: createdItems, error: itemsError } = await supabase
        .from('receipt_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw itemsError;

      console.log(`✅ Recibo ${receiptNumber} creado con ${createdItems.length} items`);

      return { ...receipt, items: createdItems };

    } catch (error) {
      console.error('❌ Error al crear recibo:', error);
      throw error;
    }
  },

  /**
   * Confirmar recibo (crear movimientos IN)
   */
  async confirm(receiptId) {
    console.log(`✅ Confirmando recibo: ${receiptId}`);

    try {
      // 1. Obtener recibo y sus items
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .select('*, receipt_items(*)')
        .eq('id', receiptId)
        .single();

      if (receiptError) throw receiptError;

      if (receipt.status === 'confirmed') {
        throw new Error('Este recibo ya fue confirmado');
      }

      // 2. Crear movimientos IN para cada item
      const movements = receipt.receipt_items.map(item => ({
        movement_type: 'IN',
        qty_signed: item.qty,  // Positivo para entrada
        warehouse_id: receipt.warehouse_id,
        product_id: item.product_id,
        user_id: receipt.operator_id,
        ref_type: 'receipt',
        ref_id: receipt.id,
        notes: `Recibo ${receipt.receipt_number} - ${item.notes || ''}`
      }));

      const { error: movementsError } = await supabase
        .from('inventory_movements')
        .insert(movements);

      if (movementsError) throw movementsError;

      // 3. Actualizar status del recibo
      const { data: updatedReceipt, error: updateError } = await supabase
        .from('receipts')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', receiptId)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`✅ Recibo ${receipt.receipt_number} confirmado - ${movements.length} movimientos creados`);

      return updatedReceipt;

    } catch (error) {
      console.error('❌ Error al confirmar recibo:', error);
      throw error;
    }
  },

  /**
   * Obtener recibo por ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('receipts')
      .select('*, receipt_items(*, products(*))')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Listar recibos
   */
  async getAll(warehouseId = null, limit = 50) {
    let query = supabase
      .from('receipts')
      .select('*, receipt_items(count)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }
};

// =====================================================
// DISPATCHES SERVICE (Salidas de Inventario)
// =====================================================

export const dispatchesService = {
  /**
   * Crear despacho (draft)
   */
  async create(dispatchData, items) {
    console.log('📤 Creando despacho de salida...');

    try {
      // 1. Generar número de despacho
      const { data: dispatchNumber, error: fnError } = await supabase
        .rpc('generate_dispatch_number');

      if (fnError) throw fnError;

      // 2. Crear despacho
      const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .insert([{
          ...dispatchData,
          dispatch_number: dispatchNumber,
          status: 'draft'
        }])
        .select()
        .single();

      if (dispatchError) throw dispatchError;

      // 3. Expandir combos a sus componentes
      console.log(`📦 Expandiendo items (${items.length} items originales)...`);
      const expandedItems = await comboProductsService.expandItems(items);
      console.log(`✨ Items expandidos: ${expandedItems.length} items finales`);

      // 4. Agrupar items por product_id (sumar cantidades si se repite)
      const itemsMap = new Map();
      for (const item of expandedItems) {
        const existing = itemsMap.get(item.product_id);
        if (existing) {
          existing.qty += item.qty;
          existing.notes = existing.notes
            ? `${existing.notes}; ${item.notes || ''}`
            : item.notes;
        } else {
          itemsMap.set(item.product_id, { ...item });
        }
      }

      const itemsToInsert = Array.from(itemsMap.values()).map(item => ({
        dispatch_id: dispatch.id,
        product_id: item.product_id,
        qty: item.qty,
        notes: item.notes
      }));

      const { data: createdItems, error: itemsError } = await supabase
        .from('dispatch_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw itemsError;

      console.log(`✅ Despacho ${dispatchNumber} creado con ${createdItems.length} items`);

      return { ...dispatch, items: createdItems };

    } catch (error) {
      console.error('❌ Error al crear despacho:', error);
      throw error;
    }
  },

  /**
   * Confirmar despacho (validar stock + crear movimientos OUT)
   */
  async confirm(dispatchId, { skipStockValidation = false } = {}) {
    console.log(`✅ Confirmando despacho: ${dispatchId}`);

    try {
      // 1. Obtener despacho con sus items
      const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .select(`
          *,
          dispatch_items(*)
        `)
        .eq('id', dispatchId)
        .single();

      if (dispatchError) throw dispatchError;

      if (dispatch.status === 'confirmed') {
        console.log(`⏭️ Despacho ${dispatchId} ya confirmado, saltando...`);
        return dispatch; // Retornar silenciosamente sin error
      }

      // Extraer order_id del shipment_record.raw_payload (query separada para evitar FK ambigua)
      let externalOrderId = null;
      if (dispatch.shipment_record_id) {
        const { data: sr } = await supabase
          .from('shipment_records')
          .select('raw_payload')
          .eq('id', dispatch.shipment_record_id)
          .single();
        if (sr?.raw_payload) {
          externalOrderId = sr.raw_payload.order_id || null;
        }
      }

      console.log(`📋 Order ID externo: ${externalOrderId || 'N/A'}`);

      // 2. Validar stock disponible (solo si no se skipea - para validación individual)
      if (!skipStockValidation) {
        const stockValidation = await inventoryService.validateStock(
          dispatch.warehouse_id,
          dispatch.dispatch_items
        );

        if (!stockValidation.valid) {
          const insufficientItems = stockValidation.results
            .filter(r => r.insufficient)
            .map(r => `${r.sku} (necesita ${r.requested}, disponible ${r.available})`)
            .join(', ');

          throw new Error(`Stock insuficiente: ${insufficientItems}`);
        }
      }

      // 3. Crear movimientos OUT para cada item (con order_id y carrier_id para rastreabilidad)
      console.log(`📦 dispatch_items para movimientos: ${dispatch.dispatch_items.length} items`);
      dispatch.dispatch_items.forEach(i => console.log(`  - product_id=${i.product_id}, qty=${i.qty}`));

      if (dispatch.dispatch_items.length === 0) {
        // Draft sin items (dispatch roto): solo marcar como confirmado sin crear movimientos
        console.warn(`⚠️ Dispatch ${dispatch.dispatch_number} sin items - confirmando sin movimientos de inventario`);
        const { data: confirmed } = await supabase
          .from('dispatches')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', dispatchId)
          .select()
          .single();
        return confirmed;
      }

      const movements = dispatch.dispatch_items.map(item => ({
        movement_type: 'OUT',
        qty_signed: -item.qty,  // Negativo para salida
        warehouse_id: dispatch.warehouse_id,
        product_id: item.product_id,
        user_id: dispatch.operator_id,
        ref_type: 'dispatch',
        ref_id: dispatch.id,
        external_order_id: externalOrderId,  // ID de orden externa (Dunamixfy, Interrápidisimo)
        carrier_id: dispatch.carrier_id,     // Transportadora
        notes: `Despacho ${dispatch.dispatch_number}${dispatch.guide_code ? ` - Guía ${dispatch.guide_code}` : ''}`
      }));

      const { data: insertedMovements, error: movementsError } = await supabase
        .from('inventory_movements')
        .insert(movements)
        .select();

      if (movementsError) throw movementsError;
      console.log(`✅ ${insertedMovements?.length || 0} movimientos OUT creados para despacho ${dispatch.dispatch_number}`);

      // 4. Actualizar status del despacho
      const { data: updatedDispatch, error: updateError } = await supabase
        .from('dispatches')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', dispatchId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 5. Marcar shipment_record como PROCESSED (si tiene guide_code)
      if (dispatch.guide_code) {
        const { error: shipmentUpdateError } = await supabase
          .from('shipment_records')
          .update({
            status: 'PROCESSED',
            processed_at: new Date().toISOString()
          })
          .eq('guide_code', dispatch.guide_code);

        if (shipmentUpdateError) {
          console.warn('⚠️ Error al marcar shipment_record como PROCESSED:', shipmentUpdateError);
          // No lanzar error, solo log de advertencia
        } else {
          console.log(`✅ Shipment record ${dispatch.guide_code} marcado como PROCESSED`);
        }
      }

      console.log(`✅ Despacho ${dispatch.dispatch_number} confirmado - ${movements.length} movimientos creados`);

      return updatedDispatch;

    } catch (error) {
      console.error('❌ Error al confirmar despacho:', error);
      throw error;
    }
  },

  /**
   * Obtener despacho por ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('dispatches')
      .select('*, dispatch_items(*, products(*))')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Obtener despacho por guide_code (idempotencia)
   */
  async getByGuideCode(guideCode) {
    const { data, error } = await supabase
      .from('dispatches')
      .select('*, dispatch_items(*, products(*))')
      .eq('guide_code', guideCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;  // No existe
      }
      throw error;
    }

    return data;
  },

  /**
   * Listar despachos
   */
  async getAll(warehouseId = null, limit = 50) {
    let query = supabase
      .from('dispatches')
      .select('*, dispatch_items(count)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  /**
   * Obtener TODOS los despachos del día actual (sin filtro de warehouse)
   * Para dashboard principal
   */
  async getAllTodayDispatches() {
    console.log(`📊 Consultando TODOS los despachos del día (sin filtro de warehouse)`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data, error } = await supabase
      .from('dispatches')
      .select(`
        *,
        dispatch_items(*, products(*)),
        shipment_record:shipment_records(*, carriers(*)),
        operator:operators!dispatches_operator_id_fkey(name)
      `)
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error al consultar todos los despachos del día:', error);
      throw error;
    }

    console.log(`✅ ${data.length} despachos encontrados (todos los warehouses)`);
    return data;
  },

  /**
   * Obtener despachos del día actual (para dashboard)
   * Incluye shipment_record para metadata de tienda
   */
  async getTodayDispatches(warehouseId) {
    console.log(`📊 Consultando despachos del día para almacén: ${warehouseId}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data, error } = await supabase
      .from('dispatches')
      .select(`
        *,
        dispatch_items(*, products(*)),
        shipment_record:shipment_records(*, carriers(*)),
        operator:operators!dispatches_operator_id_fkey(name)
      `)
      .eq('warehouse_id', warehouseId)
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false});

    if (error) {
      console.error('❌ Error al consultar despachos del día:', error);
      throw error;
    }

    console.log(`✅ ${data.length} despachos encontrados hoy`);
    return data;
  },

  /**
   * Obtener despachos de una fecha específica
   * @param {string} dateISO - Fecha en formato YYYY-MM-DD
   * @param {string|null} warehouseId - Filtrar por almacén (opcional)
   */
  async getDispatchesByDate(dateISO, warehouseId = null) {
    // Parsear como fecha LOCAL (no UTC) agregando T00:00:00 sin Z
    // new Date('2026-02-21') interpreta como UTC midnight → incorrecto en Bogotá (UTC-5)
    // new Date('2026-02-21T00:00:00') interpreta como local midnight → correcto
    const localStart = new Date(dateISO + 'T00:00:00');
    const localEnd = new Date(dateISO + 'T23:59:59.999');

    let query = supabase
      .from('dispatches')
      .select(`
        *,
        dispatch_items(*, products(*)),
        shipment_record:shipment_records(*, carriers(*)),
        operator:operators!dispatches_operator_id_fkey(name)
      `)
      .gte('created_at', localStart.toISOString())
      .lte('created_at', localEnd.toISOString())
      .order('created_at', { ascending: false });

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;
    console.log(`✅ ${data.length} despachos para fecha ${dateISO}`);
    return data;
  }
};

// =====================================================
// EXPORT DEFAULT
// =====================================================
// SKU MAPPINGS SERVICE (Mapeo de SKUs Externos)
// =====================================================

export const skuMappingsService = {
  /**
   * Obtener TODOS los mappings (para validación de duplicados)
   */
  async getAll() {
    const { data, error } = await supabase
      .from('product_sku_mappings')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Error al cargar todos los mappings:', error);
      throw error;
    }

    return data;
  },

  /**
   * Obtener todos los mappings de un producto
   */
  async getByProductId(productId) {
    console.log(`🔍 Obteniendo mappings para producto: ${productId}`);

    const { data, error } = await supabase
      .from('product_sku_mappings')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('source');

    if (error) {
      console.error('❌ Error al cargar mappings:', error);
      throw error;
    }

    console.log(`✅ ${data.length} mappings cargados`);
    return data;
  },

  /**
   * Crear mapping nuevo
   */
  async create(mappingData) {
    console.log('➕ Creando mapping:', mappingData);

    const { data, error } = await supabase
      .from('product_sku_mappings')
      .insert([mappingData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear mapping:', error);
      throw error;
    }

    console.log('✅ Mapping creado exitosamente');
    return data;
  },

  /**
   * Actualizar mapping existente
   */
  async update(mappingId, mappingData) {
    console.log(`✏️ Actualizando mapping ${mappingId}:`, mappingData);

    const { data, error } = await supabase
      .from('product_sku_mappings')
      .update(mappingData)
      .eq('id', mappingId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al actualizar mapping:', error);
      throw error;
    }

    console.log('✅ Mapping actualizado exitosamente');
    return data;
  },

  /**
   * Eliminar mapping (soft delete - marca como inactivo)
   */
  async delete(mappingId) {
    console.log(`🗑️ Eliminando mapping ${mappingId}`);

    const { error } = await supabase
      .from('product_sku_mappings')
      .update({ is_active: false })
      .eq('id', mappingId);

    if (error) {
      console.error('❌ Error al eliminar mapping:', error);
      throw error;
    }

    console.log('✅ Mapping eliminado exitosamente');
  },

  /**
   * Eliminar mapping permanentemente
   */
  async deletePermanent(mappingId) {
    console.log(`🗑️ Eliminando permanentemente mapping ${mappingId}`);

    const { error } = await supabase
      .from('product_sku_mappings')
      .delete()
      .eq('id', mappingId);

    if (error) {
      console.error('❌ Error al eliminar mapping:', error);
      throw error;
    }

    console.log('✅ Mapping eliminado permanentemente');
  }
};

// =====================================================
// COMBO PRODUCTS SERVICE
// =====================================================
// Gestión de productos combo (compuestos)
// Un combo está formado por múltiples productos simples
// =====================================================

export const comboProductsService = {
  /**
   * Obtener componentes de un producto combo
   * @param {string} comboProductId - UUID del producto combo
   * @returns {Array} Lista de componentes con estructura:
   *   [{id, quantity, component: {id, sku, name}}]
   */
  async getComponents(comboProductId) {
    const { data, error } = await supabase
      .from('product_combo_components')
      .select(`
        id,
        quantity,
        component:products!component_product_id(id, sku, name, type)
      `)
      .eq('combo_product_id', comboProductId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Guardar componentes de un combo (reemplaza existentes)
   * @param {string} comboProductId - UUID del producto combo
   * @param {Array} components - [{product_id, quantity}]
   */
  async setComponents(comboProductId, components) {
    // 1. Eliminar componentes existentes
    const { error: deleteError } = await supabase
      .from('product_combo_components')
      .delete()
      .eq('combo_product_id', comboProductId);

    if (deleteError) throw deleteError;

    // 2. Insertar nuevos componentes
    if (components.length > 0) {
      const { error: insertError } = await supabase
        .from('product_combo_components')
        .insert(
          components.map(c => ({
            combo_product_id: comboProductId,
            component_product_id: c.product_id,
            quantity: c.quantity
          }))
        );

      if (insertError) throw insertError;
    }

    console.log(`✅ Componentes guardados para combo ${comboProductId}: ${components.length} items`);
  },

  /**
   * Expandir items: Convertir combos en sus componentes
   * @param {Array} items - [{product_id, qty, product, notes}]
   * @returns {Array} - Items expandidos (combos → componentes)
   *
   * Ejemplo:
   *   Input:  [{product: COMBO (Rod+Lum), qty: 2}]
   *   Output: [{product: Rodillax, qty: 2}, {product: Lumbrax, qty: 2}]
   */
  async expandItems(items) {
    const expandedItems = [];

    for (const item of items) {
      // Verificar si el producto es un combo
      if (item.product?.type === 'combo') {
        console.log(`📦 Expandiendo combo: ${item.product.name} x${item.qty}`);

        // Obtener componentes
        const components = await this.getComponents(item.product.id);

        if (components.length === 0) {
          console.warn(`⚠️ Combo sin componentes: ${item.product.name} (${item.product.id})`);
          continue; // Skip combo vacío
        }

        // Agregar cada componente multiplicando por qty del combo
        for (const component of components) {
          const expandedQty = item.qty * component.quantity;
          console.log(`  - ${component.component.name} x${expandedQty}`);

          expandedItems.push({
            product_id: component.component.id,
            product: component.component,
            qty: expandedQty,
            notes: item.notes
              ? `${item.notes} (componente de: ${item.product.name})`
              : `Componente de combo: ${item.product.name}`
          });
        }
      } else {
        // Producto simple, agregar tal cual
        expandedItems.push(item);
      }
    }

    return expandedItems;
  }
};

// =====================================================
// BATCH SERVICE - Commit batch único
// =====================================================
// Inserta múltiples dispatches en 1 transacción
// Optimizado para escaneo rápido (sin queries intermedias)
// =====================================================

export const batchService = {
  /**
   * Crear múltiples dispatches en 1 transacción
   * @param {Array} dispatches - Array de dispatches a crear
   *   [{guide_code, warehouse_id, operator_id, carrier_id, shipment_record_data, items}]
   * @returns {Array} - Dispatches creados
   */
  async createBatch(dispatches) {
    console.log(`📦 Creando batch de ${dispatches.length} dispatches...`);
    console.time('⚡ Batch Creation Time');

    try {
      const createdDispatches = [];

      // Crear cada dispatch (aún necesitamos iterar por shipment_records)
      for (const dispatchData of dispatches) {
        // 1. Crear shipment_record
        const shipmentRecord = {
          guide_code: dispatchData.guide_code,
          carrier_id: dispatchData.carrier_id,
          source: dispatchData.shipment_record_data.source,
          raw_payload: dispatchData.shipment_record_data.raw_payload,
          status: 'PROCESSED'
        };

        const { data: sr, error: srError } = await supabase
          .from('shipment_records')
          .insert(shipmentRecord)
          .select()
          .single();

        if (srError) throw srError;

        // 2. Crear dispatch (status='draft' hasta confirmar)
        const dispatchNumber = `DISP-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const dispatch = {
          dispatch_number: dispatchNumber,
          warehouse_id: dispatchData.warehouse_id,
          operator_id: dispatchData.operator_id,
          guide_code: dispatchData.guide_code,
          shipment_record_id: sr.id,
          status: 'draft'
        };

        const { data: dp, error: dpError } = await supabase
          .from('dispatches')
          .insert(dispatch)
          .select()
          .single();

        if (dpError) throw dpError;

        // 3. Expandir combos + agrupar items
        const expandedItems = await comboProductsService.expandItems(dispatchData.items);

        const itemsMap = new Map();
        for (const item of expandedItems) {
          const existing = itemsMap.get(item.product_id);
          if (existing) {
            existing.qty += item.qty;
          } else {
            itemsMap.set(item.product_id, { ...item });
          }
        }

        // 4. Insertar dispatch_items
        const itemsToInsert = Array.from(itemsMap.values()).map(item => ({
          dispatch_id: dp.id,
          product_id: item.product_id,
          qty: item.qty,
          notes: item.notes
        }));

        const { data: items, error: itemsError } = await supabase
          .from('dispatch_items')
          .insert(itemsToInsert)
          .select();

        if (itemsError) throw itemsError;

        createdDispatches.push({ ...dp, items });
      }

      console.timeEnd('⚡ Batch Creation Time');
      console.log(`✅ Batch creado: ${createdDispatches.length} dispatches`);

      return createdDispatches;

    } catch (error) {
      console.error('❌ Error al crear batch:', error);
      throw error;
    }
  },

  /**
   * Confirmar batch completo (validar stock + crear movimientos OUT)
   * @param {Array} dispatchIds - IDs de dispatches a confirmar
   */
  async confirmBatch(dispatchIds) {
    console.log(`✅ Confirmando batch de ${dispatchIds.length} dispatches...`);
    console.time('⚡ Batch Confirm Time');

    try {
      // Confirmar cada dispatch
      for (const dispatchId of dispatchIds) {
        await dispatchesService.confirm(dispatchId);
      }

      console.timeEnd('⚡ Batch Confirm Time');
      console.log(`✅ Batch confirmado: ${dispatchIds.length} dispatches`);

    } catch (error) {
      console.error('❌ Error al confirmar batch:', error);
      throw error;
    }
  }
};

// =====================================================

export default {
  warehouses: warehousesService,
  products: productsService,
  inventory: inventoryService,
  receipts: receiptsService,
  dispatches: dispatchesService,
  skuMappings: skuMappingsService,
  comboProducts: comboProductsService,
  batch: batchService
};
