# Documentación de Importación CSV/Excel - WMS Interrápidisimo

## 📁 Formato Dunamix

Este archivo documenta el formato de importación de envíos desde Dunamix para Interrápidisimo.

### Archivo de Referencia

- **Archivo:** `interrapidisimo-sample.xlsx`
- **Filas:** 989 (ejemplo)
- **Columnas:** 79 columnas en total
- **Formato:** Excel (.xlsx) nativo de exportación Dunamix

### Columnas Clave Utilizadas

El sistema WMS extrae las siguientes columnas del archivo de Dunamix:

| Columna Excel            | Campo WMS       | Requerido | Descripción                               |
|--------------------------|-----------------|-----------|-------------------------------------------|
| `NÚMERO GUIA`            | `guide_code`    | ✅ Sí     | Código de guía de Interrápidisimo         |
| `SKU`                    | `sku`           | ✅ Sí     | SKU del producto                          |
| `CANTIDAD`               | `qty`           | ✅ Sí     | Cantidad de unidades                      |
| `PRODUCTO`               | `product_name`  | ❌ No     | Nombre del producto (solo referencia)     |
| `NOMBRE CLIENTE`         | `customer_name` | ❌ No     | Nombre del cliente (solo referencia)      |
| `ID`                     | `order_id`      | ❌ No     | ID de la orden en Dunamix                 |
| `BODEGA`                 | `warehouse_name`| ❌ No     | Nombre de la bodega origen                |
| `ESTATUS`                | `status`        | ❌ No     | Estado de la orden                        |
| `TRANSPORTADORA`         | `carrier`       | ❌ No     | Debe ser "INTERRAPIDISIMO"                |

### Características Importantes

1. **Una fila por producto:**
   - Si una orden tiene 2 productos diferentes, aparecen en 2 filas separadas
   - Ambas filas comparten el mismo `NÚMERO GUIA`
   - El sistema agrupa automáticamente por guía

2. **Ejemplo de orden multi-producto:**

   | NÚMERO GUIA  | SKU        | CANTIDAD |
   |--------------|------------|----------|
   | 240045173877 | ROD120     | 2        |
   | 240045173877 | LUMBRAX100 | 1        |

3. **Formatos soportados:**
   - ✅ Excel (.xlsx, .xls) - Recomendado
   - ✅ CSV (.csv) - Debe tener las columnas mencionadas

### Proceso de Importación

1. **Subir archivo** desde `/wms/import-csv`
2. **Preview automático** de las primeras 10 filas
3. **Validación:**
   - `NÚMERO GUIA` no vacío
   - `SKU` no vacío
   - `CANTIDAD` numérica positiva
4. **Importación:**
   - Crea/actualiza `shipment_records` agrupados por guía
   - Crea `shipment_items` por cada fila
   - Guarda errores en `csv_import_errors`
5. **Auditoría:**
   - Batch registrado en `csv_import_batches`
   - Contador de éxitos/errores
   - Detalles de errores disponibles

### Mapeo de Datos

El servicio `csvImportService.js` normaliza automáticamente las columnas de Dunamix:

```javascript
{
  guide_code: row['NÚMERO GUIA'],
  sku: row['SKU'],
  qty: row['CANTIDAD'],
  product_name: row['PRODUCTO'],
  customer_name: row['NOMBRE CLIENTE'],
  order_id: row['ID'],
  warehouse_name: row['BODEGA'],
  status: row['ESTATUS'],
  carrier: row['TRANSPORTADORA']
}
```

### Ejemplo Real (de `interrapidisimo-sample.xlsx`)

```
FECHA DE REPORTE: 29-01-2026
ID: 64274391
NÚMERO GUIA: 240045173877
SKU: ROD120
PRODUCTO: Rodillax 120ml
CANTIDAD: 2
NOMBRE CLIENTE: Graciela de Jesús Meña Pacheco
TRANSPORTADORA: INTERRAPIDISIMO
BODEGA: HC VIP Envigado
ESTATUS: GUIA_GENERADA
```

### Notas

- **No es necesario limpiar el archivo:** El sistema extrae solo las columnas necesarias
- **El archivo se importa tal como se descarga de Dunamix**
- **Todas las 79 columnas son leídas, pero solo se utilizan las mencionadas arriba**
- **Los errores de importación no detienen el proceso:** Se registran y continúa con las siguientes filas

### Solución de Problemas

**Error: "NÚMERO GUIA es requerido"**
- La columna `NÚMERO GUIA` está vacía o no existe
- Verificar que el archivo sea exportación de Dunamix

**Error: "SKU es requerido"**
- La columna `SKU` está vacía o no existe
- Verificar que el archivo contenga datos de productos

**Error: "CANTIDAD debe ser un número positivo"**
- La columna `CANTIDAD` no es numérica o es 0/negativa
- Revisar fila específica mencionada en el error

### Integración con Escaneo de Guías

Una vez importados los envíos:
1. Ir a `/wms/scan-guide`
2. Escanear código de guía (ej: `240045173877`)
3. El sistema:
   - Detecta que es Interrápidisimo
   - Busca en `shipment_records` importados desde CSV
   - Muestra productos y cantidades
   - Valida stock disponible
   - Permite confirmar despacho

---

**Última actualización:** 2026-02-05
**Versión:** WMS V1 - Fase 1
