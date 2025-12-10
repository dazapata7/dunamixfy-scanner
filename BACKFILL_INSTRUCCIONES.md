# Instrucciones: Backfill de Datos de Dunamixfy

## ¿Qué es el Backfill?

El backfill es un proceso que actualiza códigos antiguos que tienen datos NULL en las columnas:
- `customer_name`
- `order_id`
- `store_name`

Consulta la API de Dunamixfy para cada código y actualiza estos campos automáticamente.

---

## Cómo Usar el Backfill

### 1. Acceder al Admin Panel
1. Abre la aplicación en tu navegador
2. Ve al **Admin Panel** (Estadísticas en Tiempo Real)

### 2. Iniciar el Backfill
1. En el header del Admin Panel, encontrarás un botón azul: **"Actualizar desde Dunamixfy"**
2. Haz clic en el botón

### 3. Confirmación
Se abrirá un modal que te mostrará:
- **Cantidad de códigos** que necesitan actualización
- **Qué datos** se actualizarán (cliente, orden, tienda)

Botones:
- **Cancelar**: Cerrar sin hacer nada
- **Iniciar Actualización**: Comenzar el proceso

### 4. Progreso
Durante el proceso verás:
- **Barra de progreso** con porcentaje
- **Contador**: "Procesando X de Y códigos"
- **Código actual** que se está procesando

⚠️ **IMPORTANTE**: No cierres la ventana durante el proceso

### 5. Resultado
Al finalizar verás notificaciones:
- ✅ "Backfill completado: X códigos actualizados"
- ⚠️ "X códigos no pudieron actualizarse" (si hubo errores)

---

## Detalles Técnicos

### Funcionamiento
1. Consulta la tabla `codes` para encontrar registros con datos NULL
2. Para cada código:
   - Llama a `dunamixfyApi.getOrderInfo(code)`
   - Si encuentra datos, actualiza el registro
   - Si no encuentra, marca como error
3. Espera 500ms entre cada petición para no saturar la API
4. Actualiza el progreso en tiempo real

### Logs
Todos los pasos se registran en la consola del navegador:
```
📊 Obteniendo códigos que necesitan backfill...
📦 Encontrados 45 códigos para actualizar
🔄 Backfill: Consultando Dunamixfy para código 12345678...
✅ Backfill: Código 12345678 actualizado exitosamente
...
✅ Backfill completado: { total: 45, success: 42, failed: 3 }
```

### Errores Comunes
- **"Orden no encontrada"**: El código no existe en Dunamixfy
- **"API Error"**: Problema de conectividad o API key inválida
- **Timeout**: La API de Dunamixfy está tardando demasiado

---

## Verificar Resultados

### Opción 1: En la aplicación
1. Ve al tab **Historial** en el Admin Panel
2. Verifica que los códigos ahora muestren:
   - 👤 Nombre del cliente
   - 🛒 ID de la orden
   - 🏪 Nombre de la tienda

### Opción 2: En Supabase
Ejecuta este query SQL:
```sql
SELECT
  code,
  customer_name,
  order_id,
  store_name,
  created_at
FROM codes
WHERE customer_name IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

---

## Cuándo Usar el Backfill

✅ **Usar cuando**:
- Códigos antiguos tienen datos NULL
- Migración de versiones anteriores
- Después de corregir problemas con la API de Dunamixfy

❌ **NO usar cuando**:
- Los códigos ya tienen datos completos
- La API de Dunamixfy está caída
- Estás probando en desarrollo (puede consumir cuota de API)

---

## Consideraciones

### Rendimiento
- Procesa 1 código cada 500ms
- 100 códigos = ~50 segundos
- 1000 códigos = ~8 minutos

### Cuota de API
Cada código consume 1 llamada a la API de Dunamixfy. Verifica tu cuota antes de procesar muchos códigos.

### Datos que NO se actualizan
- `carrier_name`: Se mantiene el valor actual
- `scan_type`: Se mantiene el valor actual
- `created_at`: No cambia
- `raw_scan`: No cambia

Solo actualiza: `customer_name`, `order_id`, `store_name`
