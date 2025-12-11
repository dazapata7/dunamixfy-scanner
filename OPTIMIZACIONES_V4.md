# 🚀 Optimizaciones V4 - Dunamix Scanner

## Fecha: 2025-01-XX

Este documento describe las optimizaciones implementadas en la versión 4 del sistema.

---

## 📦 1. Code-Splitting y Lazy Loading

### ✅ Implementado

**Problema anterior:**
- Bundle inicial de 862 KiB (234 KiB gzipped)
- Toda la aplicación se cargaba al inicio, incluso componentes no usados
- Tiempo de carga inicial lento en móviles

**Solución:**
- Lazy loading de componentes pesados (Dashboard, Login, LoginAuth)
- html5-qrcode se carga dinámicamente solo cuando se abre el Scanner

**Resultados:**
```
ANTES:  index.js = 862 KiB (234 KiB gzipped) ⚠️
DESPUÉS:
  - index.js = 362 KiB (105 KiB gzipped) ✅ (-58% inicial)
  - Dashboard.js = 495 KiB (lazy loaded) ✅
  - Login.js = 2.56 KiB (lazy loaded) ✅
  - LoginAuth.js = 6.17 KiB (lazy loaded) ✅
```

**Beneficios:**
- ✅ Carga inicial **58% más rápida**
- ✅ Menos datos consumidos en primera carga
- ✅ Mejor experiencia de usuario (especialmente en móviles)

### Archivos modificados:
- `src/App.jsx` - Lazy loading de componentes principales
- `src/components/Login.jsx` - Export default agregado
- `src/components/LoginAuth.jsx` - Export default agregado
- `src/components/Dashboard.jsx` - Export default agregado
- `src/components/Scanner.jsx` - Dynamic import de html5-qrcode

---

## 📡 2. PWA Offline-First

### ✅ Implementado

**Problema anterior:**
- App dependía 100% de conexión a internet
- Si falla la conexión, se pierden escaneos
- Bodegas con mala señal = frustración

**Solución:**
- Sistema de cola offline con localStorage
- Sincronización automática en background
- Auto-retry con backoff exponencial

### Arquitectura:

```
┌─────────────────────────────────────────┐
│         Usuario escanea código          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    ¿Hay conexión a internet?            │
└─────┬─────────────────────┬─────────────┘
      │ SÍ                  │ NO
      ▼                     ▼
┌─────────────┐      ┌──────────────────┐
│ Guardar en  │      │ Guardar en cola  │
│ Supabase    │      │ localStorage     │
│ (online)    │      │ (offline)        │
└─────────────┘      └──────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ Auto-sync cada   │
                     │ 30 segundos      │
                     └──────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ Sincroniza con   │
                     │ Supabase cuando  │
                     │ vuelve conexión  │
                     └──────────────────┘
```

### Características:

1. **Cola Offline** (`src/services/offlineQueue.js`):
   - Almacenamiento en localStorage
   - UUID temporal para cada item
   - Retry count tracking
   - Ordenamiento por antigüedad

2. **Servicio de Sincronización** (`src/services/syncService.js`):
   - Auto-sync cada 30 segundos
   - Procesamiento por lotes (5 items)
   - Event listeners para online/offline
   - Manejo de duplicados automático
   - Max 3 reintentos por item
   - **V4.1: Backfill con Dunamixfy** 🆕
     - Consulta Dunamixfy al sincronizar si faltan datos
     - Enriquece `order_id`, `customer_name`, `store_name`
     - Valida `can_ship` antes de guardar
     - Logs detallados de backfill

3. **Feedback Visual**:
   ```javascript
   // Online (verde):
   ✅ Guardado exitosamente

   // Offline (naranja):
   💾 Guardado offline - Sincronizará automáticamente
   ```

### Archivos creados:
- `src/services/offlineQueue.js` - Sistema de cola offline
- `src/services/syncService.js` - Servicio de sincronización

### Archivos modificados:
- `src/hooks/useScanner.js` - Integración con offline queue
- `src/services/syncService.js` - Backfill con Dunamixfy (V4.1)

---

## 🔄 V4.1: Backfill Inteligente (NUEVO)

### ¿Qué es el Backfill?

**Problema anterior:**
Si escaneas offline, no puedes consultar Dunamixfy (sin internet), entonces se guardaba con datos vacíos:
```javascript
{
  code: "123456789",
  carrier_name: "Coordinadora",
  order_id: null,        // ❌ No disponible offline
  customer_name: null,   // ❌ No disponible offline
  store_name: null       // ❌ No disponible offline
}
```

**Solución V4.1:**
Al sincronizar (cuando vuelve internet), **automáticamente consulta Dunamixfy** para:
1. **Validar can_ship** (SIEMPRE, incluso si tiene datos)
2. **Enriquecer datos** faltantes (order_id, customer_name, store_name)

```javascript
// 1. PRIMERO: Validar can_ship (CRÍTICO)
const orderInfo = await dunamixfyApi.getOrderByCode(item.code);

if (orderInfo.canShip === false) {
  // ❌ Pedido NO listo → Eliminar de cola, NO guardar
  removeFromQueue(item.id);
  return { success: false };
}

// 2. SEGUNDO: Enriquecer si faltan datos
if (!item.order_id || !item.customer_name || !item.store_name) {
  enrichedData.order_id = orderInfo.order_id;
  enrichedData.customer_name = orderInfo.customer_name;
  enrichedData.store_name = orderInfo.store_name;
}

// 3. TERCERO: Guardar en Supabase (solo si pasó validación)
```

### Flujo Completo:

```
Usuario offline → Escanea código → Guarda en cola (sin datos Dunamixfy)
                                         ↓
                             Vuelve conexión (30s después)
                                         ↓
                            Sincronización automática
                                         ↓
                      ¿Faltan order_id/customer/store? → SÍ
                                         ↓
                         Consulta Dunamixfy (backfill)
                                         ↓
                              ¿canShip = NO? → Descarta item
                              ¿canShip = YES? → Enriquece datos
                                         ↓
                           Guarda en Supabase (completo) ✅
```

### Beneficios:

✅ **Datos completos** siempre (incluso si escaneaste offline)
✅ **Validación canShip** en sincronización (no guarda pedidos no listos)
✅ **Transparente** para el usuario (automático)
✅ **Logs detallados** para debugging

### Logs en Consola:

```javascript
// Cuando detecta datos faltantes
🔍 Backfill: Consultando Dunamixfy para 123456789...

// Éxito
✅ Backfill exitoso: 123456789 {order_id: "ORD-123", customer: "Juan Pérez", store: "Tienda Centro"}

// Error canShip
🚫 Backfill: Pedido 123456789 no puede ser despachado - Removiendo de cola

// Error de conexión
⚠️ Backfill: Error consultando Dunamixfy para 123456789: Network error
// (Continúa con datos originales y reintenta en próximo sync)
```

---

## 🎯 3. Uso en Producción

### Cómo funciona para el usuario:

1. **Con conexión (normal):**
   - Escanea código → Se guarda en Supabase → Toast verde ✅
   - Todo funciona como siempre

2. **Sin conexión:**
   - Escanea código → Se guarda en cola local → Toast naranja 💾
   - Mensaje: "Guardado offline - Sincronizará automáticamente"
   - El usuario puede seguir escaneando normalmente

3. **Recupera conexión:**
   - Auto-sync automático en background
   - No requiere acción del usuario
   - Códigos se sincronizan en lotes de 5

### Debugging en producción:

**Ver estado de la cola:**
```javascript
// En la consola del navegador (Eruda en móvil)
localStorage.getItem('dunamix_offline_queue')
```

**Ver estado de sincronización:**
```javascript
localStorage.getItem('dunamix_sync_status')
```

**Limpiar cola manualmente (SOLO EMERGENCIA):**
```javascript
localStorage.removeItem('dunamix_offline_queue')
```

---

## 📈 Métricas de Mejora

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Bundle inicial | 862 KiB | 362 KiB | **-58%** |
| Gzipped inicial | 234 KiB | 105 KiB | **-55%** |
| Funciona offline | ❌ No | ✅ Sí | **100%** |
| Sincronización | ❌ Manual | ✅ Automática | **100%** |

---

## 🧪 Testing Recomendado

### 1. Code-Splitting:
```bash
# Verificar que se crearon chunks separados
npm run build
ls -lh dist/assets/*.js

# Debería mostrar:
# - index-*.js (main bundle ~362 KB)
# - Dashboard-*.js (lazy loaded ~495 KB)
# - Login-*.js (lazy loaded ~2 KB)
# - LoginAuth-*.js (lazy loaded ~6 KB)
```

### 2. Offline Mode:
```bash
# En el navegador:
1. Abrir DevTools → Network → Throttling → Offline
2. Escanear un código
3. Verificar toast naranja "Guardado offline"
4. Volver a Online
5. Esperar 30 segundos (auto-sync)
6. Verificar que el código se guardó en Supabase
```

### 3. Verificar localStorage:
```javascript
// En la consola
console.log('Queue:', localStorage.getItem('dunamix_offline_queue'))
console.log('Sync:', localStorage.getItem('dunamix_sync_status'))
```

---

## 🔧 Mantenimiento

### Configuración de auto-sync:

El intervalo de sincronización se puede ajustar en `src/services/syncService.js`:

```javascript
// Línea ~168 - Cambiar de 30 segundos a otro valor
syncInterval = setInterval(() => {
  // ...
}, 30000); // 30000 = 30 segundos
```

### Tamaño de lotes:

Ajustar procesamiento por lotes en `src/services/syncService.js`:

```javascript
// Línea ~17 - Cambiar de 5 items a otro valor
const BATCH_SIZE = 5; // Procesar 5 items a la vez
```

### Reintentos máximos:

```javascript
// Línea ~16
const MAX_RETRIES = 3; // Intentos antes de descartar item
```

---

## 🐛 Troubleshooting

### Problema: "Código guardado offline pero nunca se sincroniza"

**Causas posibles:**
1. No hay conexión real (verificar `navigator.onLine`)
2. Error de Supabase (verificar logs en consola)
3. Código duplicado (se remueve automáticamente de cola)

**Solución:**
```javascript
// Forzar sincronización manual
import { syncQueue } from './src/services/syncService';
syncQueue();
```

### Problema: "localStorage lleno"

**Causa:** Muchos items en cola sin sincronizar

**Solución:**
```javascript
// Ver cuántos items hay
import { getQueueCount } from './src/services/offlineQueue';
console.log(getQueueCount());

// Limpiar cola (ÚLTIMA OPCIÓN)
import { clearQueue } from './src/services/offlineQueue';
clearQueue();
```

---

## 🎓 Aprendizajes Clave

1. **Code-splitting NO es opcional** para apps PWA móviles
2. **Offline-first es crítico** para apps de logística/bodegas
3. **Auto-sync en background** mejora UX significativamente
4. **localStorage + Supabase** = Arquitectura resiliente
5. **Lazy loading de librerías pesadas** (html5-qrcode) reduce bundle inicial

---

## 🚀 Próximos Pasos Sugeridos

### Corto plazo (opcionales):
- [ ] Agregar indicador visual de "pendientes de sincronizar" en UI
- [ ] Notificación cuando se complete sincronización
- [ ] Límite de items en cola (ej: máximo 100)

### Mediano plazo (mejoras futuras):
- [ ] IndexedDB en lugar de localStorage (mejor para muchos items)
- [ ] Service Worker para sync verdadero en background
- [ ] Compresión de datos en cola offline

### Largo plazo (monitoreo):
- [ ] Sentry o similar para tracking de errores
- [ ] Analytics de uso offline vs online
- [ ] Alertas si cola supera threshold

---

## 📝 Changelog

### V4.1 (2025-01-XX) - ACTUAL
- ✅ **Backfill inteligente con Dunamixfy en sincronización**
  - Consulta automática de Dunamixfy al sincronizar
  - Enriquece order_id, customer_name, store_name
  - Valida can_ship antes de guardar
  - Logs detallados para debugging

### V4.0 (2025-01-XX)
- ✅ Code-splitting con lazy loading (-58% bundle inicial)
- ✅ PWA offline-first con queue + auto-sync
- ✅ html5-qrcode dynamic import
- ✅ Feedback visual diferenciado (online/offline)

---

**Autor:** Claude Code + dazap
**Fecha:** 2025-01-XX
**Versión:** 4.0
