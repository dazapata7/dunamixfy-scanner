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

    // Filtro de búsqueda opcional
    if (searchTerm) {
      query = query.or(`sku.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query.order('sku');

    if (error) {
      console.error('❌ Error al consultar inventario:', error);
      throw error;
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

      // 3. Crear items
      const itemsToInsert = items.map(item => ({
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
  async confirm(dispatchId) {
    console.log(`✅ Confirmando despacho: ${dispatchId}`);

    try {
      // 1. Obtener despacho y sus items
      const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .select('*, dispatch_items(*)')
        .eq('id', dispatchId)
        .single();

      if (dispatchError) throw dispatchError;

      if (dispatch.status === 'confirmed') {
        throw new Error('Este despacho ya fue confirmado');
      }

      // 2. Validar stock disponible
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

      // 3. Crear movimientos OUT para cada item
      const movements = dispatch.dispatch_items.map(item => ({
        movement_type: 'OUT',
        qty_signed: -item.qty,  // Negativo para salida
        warehouse_id: dispatch.warehouse_id,
        product_id: item.product_id,
        user_id: dispatch.operator_id,
        ref_type: 'dispatch',
        ref_id: dispatch.id,
        notes: `Despacho ${dispatch.dispatch_number}${dispatch.guide_code ? ` - Guía ${dispatch.guide_code}` : ''}`
      }));

      const { error: movementsError } = await supabase
        .from('inventory_movements')
        .insert(movements);

      if (movementsError) throw movementsError;

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
        dispatch_items(*, product:products(*)),
        shipment_record:shipment_records(*)
      `)
      .eq('warehouse_id', warehouseId)
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error al consultar despachos del día:', error);
      throw error;
    }

    console.log(`✅ ${data.length} despachos encontrados hoy`);
    return data;
  }
};

// =====================================================
// EXPORT DEFAULT
// =====================================================

export default {
  warehouses: warehousesService,
  products: productsService,
  inventory: inventoryService,
  receipts: receiptsService,
  dispatches: dispatchesService
};
