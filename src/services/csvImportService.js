// =====================================================
// CSV IMPORT SERVICE - Dunamix WMS
// =====================================================
// Importación de envíos desde CSV/Excel (principalmente Interrápidisimo)
// Validación, parsing, guardado en BD y auditoría
// Soporta formato de exportación Dunamix (.xlsx)
// =====================================================

import { supabase } from './supabase';
import * as XLSX from 'xlsx';

// =====================================================
// CSV IMPORT SERVICE
// =====================================================

export const csvImportService = {
  /**
   * Importar CSV/Excel de Interrápidisimo (Formato Dunamix)
   * Soporta .csv y .xlsx (Excel)
   * Formato Dunamix: NÚMERO GUIA, SKU, CANTIDAD (entre 79 columnas)
   *
   * ⚡ OPTIMIZADO: Usa operaciones bulk en lugar de row-by-row
   * ANTES: 500 filas = ~1500 viajes BD secuenciales
   * AHORA: 500 filas = ~10 viajes BD en paralelo
   *
   * @param {File} file - Archivo CSV o Excel
   * @param {string} carrierId - ID de la transportadora
   * @param {string} operatorId - ID del operador que importa
   * @param {function} onProgress - Callback (current, total, message) opcional
   * @returns {Promise<Object>} - { batchId, successCount, errorCount, errors }
   */
  // Alias genérico — funciona para cualquier transportadora
  async importCSV(file, carrierId, operatorId, onProgress = null) {
    return this.importInterrapidisimoCSV(file, carrierId, operatorId, onProgress);
  },

  async importInterrapidisimoCSV(file, carrierId, operatorId, onProgress = null) {
    const report = (current, total, message) => {
      if (onProgress) onProgress(current, total, message);
    };

    console.log('📤 Iniciando importación bulk:', file.name);
    console.time('⚡ CSV Import Total');

    try {
      // ── FASE 1: Parsear y validar ────────────────────────────────────
      report(2, 100, 'Leyendo archivo...');
      const parsedData = await this.parseFile(file);

      if (!parsedData || parsedData.length === 0) {
        throw new Error('El archivo CSV está vacío o no se pudo leer');
      }

      console.log(`📊 CSV parseado: ${parsedData.length} filas`);
      report(8, 100, `Validando ${parsedData.length} filas...`);

      // Validar todas las filas en memoria (sin BD, ultra rápido)
      const validRows = [];
      const validationErrors = [];

      parsedData.forEach((row, i) => {
        try {
          this.validateRow(row, i + 2);
          validRows.push(row);
        } catch (err) {
          validationErrors.push({ row: i + 2, message: err.message, data: row });
        }
      });

      console.log(`✅ Válidas: ${validRows.length} | ❌ Errores: ${validationErrors.length}`);

      // ── FASE 2: Crear batch en BD ─────────────────────────────────────
      report(12, 100, 'Creando registro de importación...');
      const batch = await this.createBatch({
        filename: file.name,
        carrier_id: carrierId,
        operator_id: operatorId,
        total_rows: parsedData.length,
        status: 'processing'
      });
      console.log(`📝 Batch creado: ${batch.id}`);

      // ── FASE 3: Agrupar filas por guide_code ──────────────────────────
      // Una guía puede tener múltiples ítems (múltiples filas con mismo guide_code)
      report(15, 100, 'Agrupando guías...');
      const guideMap = new Map(); // guide_code → [rows]
      for (const row of validRows) {
        const gc = String(row.guide_code || '').trim();
        if (!guideMap.has(gc)) guideMap.set(gc, []);
        guideMap.get(gc).push(row);
      }
      const guideCodes = Array.from(guideMap.keys());
      console.log(`📦 Guías únicas: ${guideCodes.length} (de ${validRows.length} filas)`);

      // ── FASE 4: Verificar guías existentes (1 query en lugar de N) ────
      report(20, 100, 'Verificando guías existentes...');
      const existingMap = new Map(); // guide_code → {id, status}

      // Chunk para evitar URLs muy largas en la API REST
      const CHUNK_SIZE = 200;
      for (let i = 0; i < guideCodes.length; i += CHUNK_SIZE) {
        const chunk = guideCodes.slice(i, i + CHUNK_SIZE);
        const { data: existing } = await supabase
          .from('shipment_records')
          .select('id, guide_code, status')
          .in('guide_code', chunk)
          .eq('carrier_id', carrierId);

        for (const rec of (existing || [])) {
          existingMap.set(rec.guide_code, rec);
        }
      }

      console.log(`📊 Existentes: ${existingMap.size} | Nuevas: ${guideCodes.length - existingMap.size}`);

      // ── FASE 5: Insertar guías NUEVAS en bulk ─────────────────────────
      report(28, 100, `Creando ${guideCodes.length - existingMap.size} guías nuevas...`);
      const shipmentIdMap = new Map(); // guide_code → id

      // Registrar IDs de las existentes
      for (const [gc, rec] of existingMap) {
        shipmentIdMap.set(gc, rec.id);
      }

      const newGuideCodes = guideCodes.filter(gc => !existingMap.has(gc));
      if (newGuideCodes.length > 0) {
        const newRecords = newGuideCodes.map(gc => {
          const firstRow = guideMap.get(gc)[0];
          return {
            carrier_id: carrierId,
            guide_code: gc,
            source: 'CSV',
            status: 'READY',
            raw_payload: {
              batch_id: batch.id,
              imported_at: new Date().toISOString(),
              order_id: firstRow.order_id || null,
              customer_name: firstRow.customer_name || null,
              store: firstRow.store_name || 'Sin tienda',
              dropshipper: firstRow.dropshipper || null,
              warehouse: firstRow.warehouse_name || null,
              status: firstRow.status || null,
              tienda: firstRow.tienda_column || null
            }
          };
        });

        // Insertar en chunks de 100
        for (let i = 0; i < newRecords.length; i += 100) {
          const chunk = newRecords.slice(i, i + 100);
          const { data: inserted, error: insertError } = await supabase
            .from('shipment_records')
            .insert(chunk)
            .select('id, guide_code');

          if (insertError) throw insertError;

          for (const r of (inserted || [])) {
            shipmentIdMap.set(r.guide_code, r.id);
          }

          const done = Math.min(i + 100, newRecords.length);
          report(28 + Math.round(done / newRecords.length * 15), 100,
            `Creando guías... ${done}/${newRecords.length}`);
        }
      }

      // ── FASE 6: Resetear guías EXISTENTES a READY ────────────────────
      report(43, 100, 'Actualizando guías existentes...');
      const toResetIds = guideCodes
        .filter(gc => existingMap.has(gc) && existingMap.get(gc).status !== 'READY')
        .map(gc => existingMap.get(gc).id);

      if (toResetIds.length > 0) {
        for (let i = 0; i < toResetIds.length; i += 200) {
          const chunk = toResetIds.slice(i, i + 200);
          await supabase.from('shipment_records').update({ status: 'READY' }).in('id', chunk);
        }
        console.log(`🔄 ${toResetIds.length} guías actualizadas a READY`);
      }

      // ── FASE 7: Obtener ítems existentes (1 query en lugar de N) ──────
      report(50, 100, 'Verificando ítems existentes...');
      const allShipmentIds = Array.from(shipmentIdMap.values());
      const existingItemsMap = new Map(); // `${srId}:${sku}:${extId}` → {id, qty}

      for (let i = 0; i < allShipmentIds.length; i += CHUNK_SIZE) {
        const chunk = allShipmentIds.slice(i, i + CHUNK_SIZE);
        const { data: items } = await supabase
          .from('shipment_items')
          .select('id, shipment_record_id, sku, external_product_id, qty')
          .in('shipment_record_id', chunk);

        for (const item of (items || [])) {
          const key = `${item.shipment_record_id}:${item.sku}:${item.external_product_id ?? 'null'}`;
          existingItemsMap.set(key, item);
        }
      }

      // ── FASE 8: Clasificar ítems en nuevos vs actualizaciones ─────────
      report(58, 100, 'Procesando ítems...');
      const itemsToInsert = [];
      const itemsToUpdate = []; // [{id, qty}]

      for (const [gc, rows] of guideMap) {
        const srId = shipmentIdMap.get(gc);
        if (!srId) continue;

        for (const row of rows) {
          const sku = String(row.sku || '').trim().toUpperCase();
          const qty = parseInt(String(row.qty || '1'), 10);
          const extId = row.product_id_external || null;
          const key = `${srId}:${sku}:${extId ?? 'null'}`;

          if (existingItemsMap.has(key)) {
            const existing = existingItemsMap.get(key);
            if (existing.qty !== qty) {
              itemsToUpdate.push({ id: existing.id, qty });
            }
          } else {
            itemsToInsert.push({
              shipment_record_id: srId,
              sku,
              qty,
              external_product_id: extId,
              product_id: null
            });
          }
        }
      }

      // ── FASE 9: Insertar ítems NUEVOS en bulk ─────────────────────────
      report(62, 100, `Insertando ${itemsToInsert.length} ítems nuevos...`);
      let dbErrorCount = 0;

      if (itemsToInsert.length > 0) {
        for (let i = 0; i < itemsToInsert.length; i += 100) {
          const chunk = itemsToInsert.slice(i, i + 100);
          const { error: itemError } = await supabase.from('shipment_items').insert(chunk);
          if (itemError) {
            console.error('❌ Error insertando ítems:', itemError.message);
            dbErrorCount += chunk.length;
          }

          const done = Math.min(i + 100, itemsToInsert.length);
          report(62 + Math.round(done / itemsToInsert.length * 20), 100,
            `Insertando ítems... ${done}/${itemsToInsert.length}`);
        }
      }

      // ── FASE 10: Actualizar ítems con cantidad cambiada (en paralelo) ──
      report(82, 100, `Actualizando ${itemsToUpdate.length} ítems...`);
      if (itemsToUpdate.length > 0) {
        // Actualizar en paralelo por chunks de 50
        for (let i = 0; i < itemsToUpdate.length; i += 50) {
          const chunk = itemsToUpdate.slice(i, i + 50);
          await Promise.all(
            chunk.map(item =>
              supabase.from('shipment_items').update({ qty: item.qty }).eq('id', item.id)
            )
          );
        }
        console.log(`🔄 ${itemsToUpdate.length} ítems actualizados`);
      }

      // ── FASE 11: Guardar errores de validación ────────────────────────
      report(90, 100, 'Finalizando...');
      if (validationErrors.length > 0) {
        // Guardar errores en paralelo
        await Promise.all(
          validationErrors.map(err =>
            this.saveError({
              batch_id: batch.id,
              row_number: err.row,
              error_message: err.message,
              raw_data: err.data
            })
          )
        );
      }

      // ── FASE 12: Actualizar batch con resultados ──────────────────────
      const successCount = validRows.length - dbErrorCount;
      const errorCount = validationErrors.length + dbErrorCount;

      await this.updateBatch(batch.id, {
        success_count: successCount,
        error_count: errorCount,
        status: 'completed'
      });

      console.timeEnd('⚡ CSV Import Total');
      console.log(`✅ Importación completada: ${successCount} éxitos, ${errorCount} errores`);

      report(100, 100, 'Completado');

      return {
        batchId: batch.id,
        successCount,
        errorCount,
        errors: validationErrors
      };

    } catch (error) {
      console.error('❌ Error en importación CSV:', error);
      throw error;
    }
  },

  /**
   * Parsear archivo (CSV o Excel)
   * Detecta formato y delega al parser correcto
   */
  async parseFile(file) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      console.log('📊 Detectado: Excel (.xlsx/.xls)');
      return this.parseExcel(file);
    } else if (fileName.endsWith('.csv')) {
      console.log('📄 Detectado: CSV (.csv)');
      return this.parseCSV(file);
    } else {
      throw new Error('Formato no soportado. Use .csv, .xlsx o .xls');
    }
  },

  /**
   * Parsear archivo Excel (.xlsx, .xls)
   * Usa librería xlsx (SheetJS)
   * Mapea columnas del formato Dunamix
   */
  async parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Usar primera hoja
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          // Convertir a JSON (array de objetos)
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (jsonData.length === 0) {
            reject(new Error('El archivo Excel está vacío'));
            return;
          }

          console.log(`📊 Excel parseado: ${jsonData.length} filas`);

          // Mapear columnas de Dunamix a formato estándar
          const normalizedData = jsonData.map(row => this.normalizeDunamixRow(row));

          resolve(normalizedData);

        } catch (error) {
          reject(new Error(`Error al parsear Excel: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Error al leer el archivo Excel'));
      };

      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Normalizar fila de formato Dunamix a formato estándar
   * Mapea columnas específicas de Dunamix
   */
  normalizeDunamixRow(row) {
    // Extraer nombre de tienda
    let storeName = row['NOMBRE TIENDA'] || null;

    // Si NOMBRE TIENDA es null, usar DROPSHIPPER pero quitando el código (ID)
    if (!storeName || storeName === 'null' || storeName.trim() === '') {
      const dropshipper = row['DROPSHIPPER'] || '';
      // Formato: "Nombre (ID)" → extraer solo "Nombre"
      const match = dropshipper.match(/^(.+?)\s*\(/);
      storeName = match ? match[1].trim() : dropshipper;
    }

    return {
      guide_code: row['NÚMERO GUIA'] || row['NUMERO GUIA'] || '',
      sku: row['SKU'] || '',
      qty: row['CANTIDAD'] || '1',
      product_name: row['PRODUCTO'] || '',
      product_id_external: row['PRODUCTO ID'] || null,  // 🔥 NUEVO: ID del producto en Dunamix
      customer_name: row['NOMBRE CLIENTE'] || '',
      order_id: row['ID'] || '',
      // Campos adicionales (opcionales)
      warehouse_name: row['BODEGA'] || '',
      store_name: storeName || 'Sin tienda',
      dropshipper: row['DROPSHIPPER'] || '',
      status: row['ESTATUS'] || '',
      carrier: row['TRANSPORTADORA'] || '',
      // Metadata adicional
      tienda_column: row['TIENDA'] || null
    };
  },

  /**
   * Parsear archivo CSV
   * Usa papaparse para parsing robusto
   */
  async parseCSV(file) {
    return new Promise((resolve, reject) => {
      // Verificar si papaparse está disponible
      if (typeof window.Papa === 'undefined') {
        // Si no está disponible, usar método manual básico
        console.warn('⚠️ Papaparse no disponible, usando parser básico');
        this.parseCSVManual(file)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Usar papaparse si está disponible
      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('⚠️ Errores de parsing:', results.errors);
          }
          resolve(results.data);
        },
        error: (error) => {
          reject(new Error(`Error al parsear CSV: ${error.message}`));
        }
      });
    });
  },

  /**
   * Parser CSV manual (fallback si papaparse no está disponible)
   */
  async parseCSVManual(file) {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('Archivo CSV vacío');
    }

    // Primera línea es el header
    const headers = lines[0]
      .split(',')
      .map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Validar que tenga las columnas requeridas
    if (!headers.includes('guide_code') && !headers.includes('guidecode')) {
      throw new Error('CSV debe tener columna "guide_code"');
    }

    if (!headers.includes('sku')) {
      throw new Error('CSV debe tener columna "sku"');
    }

    if (!headers.includes('qty') && !headers.includes('quantity')) {
      throw new Error('CSV debe tener columna "qty" o "quantity"');
    }

    // Parsear filas
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));

      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Normalizar nombres de columnas
      row.guide_code = row.guide_code || row.guidecode;
      row.qty = row.qty || row.quantity || '1';

      data.push(row);
    }

    return data;
  },

  /**
   * Validar fila del CSV/Excel
   */
  validateRow(row, rowNumber) {
    // 1. guide_code es requerido
    const guideCode = String(row.guide_code || '').trim();
    if (!guideCode || guideCode === '') {
      throw new Error(`Fila ${rowNumber}: Número de guía (NÚMERO GUIA) es requerido`);
    }

    // 2. sku es requerido
    const sku = String(row.sku || '').trim();
    if (!sku || sku === '') {
      throw new Error(`Fila ${rowNumber}: SKU es requerido`);
    }

    // 3. qty debe ser numérico positivo
    const qtyStr = String(row.qty || '1').trim();
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Fila ${rowNumber}: CANTIDAD debe ser un número positivo (actual: "${qtyStr}")`);
    }

    // 4. Longitud razonable
    if (guideCode.length > 50) {
      throw new Error(`Fila ${rowNumber}: Número de guía muy largo (máx 50 caracteres)`);
    }

    if (sku.length > 100) {
      throw new Error(`Fila ${rowNumber}: SKU muy largo (máx 100 caracteres)`);
    }

    return true;
  },

  /**
   * Crear shipment_record y shipment_items desde fila CSV/Excel
   */
  async createShipmentFromRow(row, carrierId, batchId) {
    const guideCode = String(row.guide_code || '').trim();
    const sku = String(row.sku || '').trim().toUpperCase();
    const qty = parseInt(String(row.qty || '1'), 10);

    // 1. Verificar si ya existe shipment_record para esta guía
    const { data: existing, error: checkError } = await supabase
      .from('shipment_records')
      .select('id, status')
      .eq('guide_code', guideCode)
      .eq('carrier_id', carrierId)
      .maybeSingle(); // maybeSingle: retorna null si no existe (no lanza 406)

    let shipmentRecordId;

    if (existing) {
      // Ya existe - actualizar status a READY (permite re-escaneo)
      shipmentRecordId = existing.id;

      if (existing.status !== 'READY') {
        await supabase
          .from('shipment_records')
          .update({ status: 'READY' })
          .eq('id', existing.id);

        console.log(`🔄 Guía existente: ${guideCode} - status actualizado a READY`);
      } else {
        console.log(`📝 Guía existente: ${guideCode} - ya está READY`);
      }

    } else {
      // Crear nuevo shipment_record con metadata completa
      const { data: newShipment, error: shipmentError } = await supabase
        .from('shipment_records')
        .insert([{
          carrier_id: carrierId,
          guide_code: guideCode,
          source: 'CSV',
          status: 'READY',
          raw_payload: {
            batch_id: batchId,
            imported_at: new Date().toISOString(),
            // Metadata de Dunamix para dashboard
            order_id: row.order_id || null,
            customer_name: row.customer_name || null,
            store: row.store_name || 'Sin tienda',   // NOMBRE TIENDA o DROPSHIPPER (sin ID)
            dropshipper: row.dropshipper || null,    // DROPSHIPPER completo con ID
            warehouse: row.warehouse_name || null,   // BODEGA
            status: row.status || null,              // ESTATUS
            tienda: row.tienda_column || null        // Columna TIENDA adicional
          }
        }])
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      shipmentRecordId = newShipment.id;
      console.log(`📝 Nueva guía creada: ${guideCode}`);
    }

    // 2. Verificar si ya existe este item (mismo SKU + external_product_id en esta guía)
    const { data: existingItem } = await supabase
      .from('shipment_items')
      .select('id, qty')
      .eq('shipment_record_id', shipmentRecordId)
      .eq('sku', sku)
      .eq('external_product_id', row.product_id_external || null)
      .maybeSingle();

    if (existingItem) {
      // Item ya existe - actualizar cantidad si cambió
      if (existingItem.qty !== qty) {
        await supabase
          .from('shipment_items')
          .update({ qty: qty })
          .eq('id', existingItem.id);

        console.log(`🔄 Item actualizado: ${sku} - cantidad ${existingItem.qty} → ${qty}`);
      } else {
        console.log(`✓ Item ya existe: ${sku} (sin cambios)`);
      }
    } else {
      // Item nuevo - insertar
      const { error: itemError } = await supabase
        .from('shipment_items')
        .insert([{
          shipment_record_id: shipmentRecordId,
          sku: sku,
          qty: qty,
          external_product_id: row.product_id_external || null,  // 🔥 ID del producto en Dunamix CSV
          product_id: null  // Se mapeará al procesar el despacho
        }]);

      if (itemError) {
        throw itemError;
      }

      console.log(`✅ Item nuevo creado: ${sku}`);
    }

    return shipmentRecordId;
  },

  /**
   * Crear batch de importación
   */
  async createBatch(batchData) {
    const { data, error } = await supabase
      .from('csv_import_batches')
      .insert([batchData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar batch con resultados
   */
  async updateBatch(batchId, updates) {
    const { data, error } = await supabase
      .from('csv_import_batches')
      .update(updates)
      .eq('id', batchId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Guardar error de importación
   */
  async saveError(errorData) {
    const { error } = await supabase
      .from('csv_import_errors')
      .insert([errorData]);

    if (error) {
      console.error('❌ Error al guardar error:', error);
      // No lanzar error aquí para no interrumpir el proceso
    }
  },

  /**
   * Obtener batches de importación
   */
  async getBatches(limit = 20) {
    const { data, error } = await supabase
      .from('csv_import_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * Obtener errores de un batch
   */
  async getBatchErrors(batchId) {
    const { data, error } = await supabase
      .from('csv_import_errors')
      .select('*')
      .eq('batch_id', batchId)
      .order('row_number');

    if (error) throw error;
    return data;
  },

  /**
   * Obtener batch por ID con errores
   */
  async getBatchWithErrors(batchId) {
    const { data: batch, error: batchError } = await supabase
      .from('csv_import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError) throw batchError;

    const errors = await this.getBatchErrors(batchId);

    return {
      ...batch,
      errors
    };
  },

  /**
   * Validar formato CSV/Excel antes de importar (preview)
   * Retorna primeras 10 filas + validación
   */
  async validateCSVFormat(file) {
    try {
      const parsedData = await this.parseFile(file);

      if (!parsedData || parsedData.length === 0) {
        return {
          valid: false,
          error: 'Archivo vacío',
          preview: []
        };
      }

      // Validar primeras 10 filas
      const preview = parsedData.slice(0, 10);
      const validationErrors = [];

      preview.forEach((row, index) => {
        try {
          this.validateRow(row, index + 2);
        } catch (error) {
          validationErrors.push({
            row: index + 2,
            message: error.message
          });
        }
      });

      return {
        valid: validationErrors.length === 0,
        totalRows: parsedData.length,
        preview,
        validationErrors
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        preview: []
      };
    }
  }
};

export default csvImportService;
