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
   * @param {File} file - Archivo CSV o Excel
   * @param {string} carrierId - ID de la transportadora
   * @param {string} operatorId - ID del operador que importa
   * @returns {Promise<Object>} - { batchId, successCount, errorCount, errors }
   */
  async importInterrapidisimoCSV(file, carrierId, operatorId) {
    console.log('📤 Iniciando importación:', file.name);

    try {
      // 1. Parsear archivo (detecta CSV o Excel automáticamente)
      const parsedData = await this.parseFile(file);

      if (!parsedData || parsedData.length === 0) {
        throw new Error('El archivo CSV está vacío o no se pudo leer');
      }

      console.log(`📊 CSV parseado: ${parsedData.length} filas`);

      // 2. Crear batch de importación
      const batch = await this.createBatch({
        filename: file.name,
        carrier_id: carrierId,
        operator_id: operatorId,
        total_rows: parsedData.length,
        status: 'processing'
      });

      console.log(`📝 Batch creado: ${batch.id}`);

      // 3. Procesar cada fila
      const results = {
        successCount: 0,
        errorCount: 0,
        errors: []
      };

      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const rowNumber = i + 2;  // +2 porque la fila 1 es el header y empezamos en 0

        try {
          // Validar fila
          this.validateRow(row, rowNumber);

          // Crear/actualizar shipment_record
          await this.createShipmentFromRow(row, carrierId, batch.id);

          results.successCount++;

        } catch (error) {
          console.error(`❌ Error en fila ${rowNumber}:`, error.message);

          // Guardar error en BD
          await this.saveError({
            batch_id: batch.id,
            row_number: rowNumber,
            error_message: error.message,
            raw_data: row
          });

          results.errorCount++;
          results.errors.push({
            row: rowNumber,
            message: error.message,
            data: row
          });
        }
      }

      // 4. Actualizar batch con resultados
      await this.updateBatch(batch.id, {
        success_count: results.successCount,
        error_count: results.errorCount,
        status: results.errorCount === 0 ? 'completed' : 'completed'  // completed aunque tenga errores
      });

      console.log(`✅ Importación completada:`);
      console.log(`  - Éxitos: ${results.successCount}`);
      console.log(`  - Errores: ${results.errorCount}`);

      return {
        batchId: batch.id,
        ...results
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
    return {
      guide_code: row['NÚMERO GUIA'] || row['NUMERO GUIA'] || '',
      sku: row['SKU'] || '',
      qty: row['CANTIDAD'] || '1',
      product_name: row['PRODUCTO'] || '',
      customer_name: row['NOMBRE CLIENTE'] || '',
      order_id: row['ID'] || '',
      // Campos adicionales (opcionales)
      warehouse_name: row['BODEGA'] || '',
      status: row['ESTATUS'] || '',
      carrier: row['TRANSPORTADORA'] || ''
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
      .select('id')
      .eq('guide_code', guideCode)
      .eq('carrier_id', carrierId)
      .single();

    let shipmentRecordId;

    if (existing) {
      // Ya existe, usar el existente
      shipmentRecordId = existing.id;
      console.log(`📝 Guía existente: ${guideCode} - agregando item`);

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
            store: row.product_name ? null : (row.warehouse_name || 'Sin tienda'),  // Usar BODEGA o NOMBRE TIENDA
            dropshipper: row.customer_name || null,  // DROPSHIPPER del Excel
            warehouse: row.warehouse_name || null,   // BODEGA
            status: row.status || null               // ESTATUS
          }
        }])
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      shipmentRecordId = newShipment.id;
      console.log(`📝 Nueva guía creada: ${guideCode}`);
    }

    // 2. Crear shipment_item (puede haber múltiples items por guía)
    const { error: itemError } = await supabase
      .from('shipment_items')
      .insert([{
        shipment_record_id: shipmentRecordId,
        sku: sku,
        qty: qty,
        product_id: null  // Se mapeará al procesar el despacho
      }]);

    if (itemError) {
      // Si es duplicado (mismo SKU en la misma guía), podría ser un error
      if (itemError.code === '23505') {
        throw new Error(`SKU ${sku} duplicado en guía ${guideCode}`);
      }
      throw itemError;
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
