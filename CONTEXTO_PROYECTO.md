# CONTEXTO DEL PROYECTO - DUNAMIX SCANNER V2

## 🎯 ESTADO ACTUAL

### ✅ Completado:
1. Base de datos V2 creada en Supabase con arquitectura normalizada
2. Tablas creadas: `carriers`, `stores`, `operators`, `codes`
3. Datos iniciales insertados:
   - 2 transportadoras (Coordinadora, Interrápidisimo)
   - 5 tiendas (Dunamixfy, Femme Cosmetics, Rodillax Store, Lumbrax Store, Drop1 SAS)
4. Proyecto React + Vite funcionando en localhost:5173
5. Dependencias instaladas (npm install completado)

### 🔄 Pendiente de Migración:
El proyecto tiene archivos V1 y V2. Necesitamos migrar de V1 a V2.

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
dunamix-scanner/
├── src/
│   ├── components/
│   │   ├── Login.jsx                    ✅ OK (no requiere cambios)
│   │   ├── Dashboard.jsx                ⚠️ Actualizar import de StoreSelector
│   │   ├── Scanner.jsx                  ✅ OK (funcionará con nuevos hooks)
│   │   ├── Stats.jsx                    ✅ OK (funcionará con nuevos servicios)
│   │   ├── StoreSelector.jsx            ❌ Versión vieja (hardcoded)
│   │   └── StoreSelectorV2.jsx          ✅ Nueva (usa BD)
│   ├── hooks/
│   │   ├── useScanner.js                ❌ Versión vieja
│   │   ├── useScannerV2.js              ✅ Nueva
│   │   ├── useRealtime.js               ❌ Versión vieja
│   │   └── useRealtimeV2.js             ✅ Nueva
│   ├── services/
│   │   ├── supabase.js                  ❌ Versión vieja
│   │   └── supabase-v2.js               ✅ Nueva
│   ├── utils/
│   │   ├── validators.js                ❌ Versión vieja (hardcoded)
│   │   └── validators-v2.js             ✅ Nueva (dinámica con BD)
│   ├── store/
│   │   └── useStore.js                  ✅ OK (compatible con V2)
│   ├── App.jsx                          ✅ OK (no requiere cambios)
│   ├── App.css                          ✅ OK
│   └── main.jsx                         ✅ OK
├── .env                                 ✅ Configurado
├── package.json                         ✅ OK
├── vite.config.js                       ✅ OK
├── tailwind.config.js                   ✅ OK
└── README-V2.md                         📖 Documentación

SQL Files (para referencia):
├── supabase-schema-v2.sql               ✅ Ejecutado en Supabase
├── migration-v1-to-v2.sql               ℹ️ No necesario (empezamos de cero)
└── migration-add-store.sql              ℹ️ No necesario (ya en V2)
```

---

## 🔧 CAMBIOS NECESARIOS PARA MIGRAR A V2

### PASO 1: Actualizar Servicios
**Archivo:** `src/services/supabase.js`
**Acción:** Reemplazar contenido con el de `supabase-v2.js`
**Razón:** V2 tiene servicios separados (carriersService, storesService, operatorsService, codesService)

### PASO 2: Actualizar Validadores
**Archivo:** `src/utils/validators.js`
**Acción:** Reemplazar contenido con el de `validators-v2.js`
**Razón:** V2 valida códigos dinámicamente contra carriers desde la BD

### PASO 3: Actualizar Hook Scanner
**Archivo:** `src/hooks/useScanner.js`
**Acción:** Reemplazar contenido con el de `useScannerV2.js`
**Razón:** V2 carga carriers desde BD y valida dinámicamente

### PASO 4: Actualizar Hook Realtime
**Archivo:** `src/hooks/useRealtime.js`
**Acción:** Reemplazar contenido con el de `useRealtimeV2.js`
**Razón:** V2 trabaja con la nueva estructura de BD

### PASO 5: Actualizar Dashboard
**Archivo:** `src/components/Dashboard.jsx`
**Línea:** ~3 (imports)
**Cambio:** 
```javascript
// Cambiar:
import { StoreSelector } from './StoreSelector';

// Por:
import { StoreSelector } from './StoreSelectorV2';
```
**Razón:** StoreSelectorV2 carga tiendas desde la BD en lugar de lista hardcoded

---

## 🗄️ ARQUITECTURA DE BASE DE DATOS V2

### Tabla: carriers (transportadoras)
```sql
- id (UUID)
- name (TEXT) - "Coordinadora"
- code (TEXT) - "coordinadora" 
- display_name (TEXT) - "Coordinadora"
- validation_rules (JSONB) - Reglas de validación
- extraction_config (JSONB) - Cómo extraer el código
- is_active (BOOLEAN)
```

**Ejemplo de validation_rules:**
```json
{
  "pattern": "ends_with_001",
  "min_length": 20
}
```

**Ejemplo de extraction_config:**
```json
{
  "method": "slice",
  "start": -14,
  "end": -3
}
```

### Tabla: stores (tiendas)
```sql
- id (UUID)
- name (TEXT) - "Dunamixfy"
- code (TEXT) - "dunamixfy"
- description (TEXT)
- is_active (BOOLEAN)
```

### Tabla: operators (operarios)
```sql
- id (UUID)
- name (TEXT) - "Daniel"
- email (TEXT)
- phone (TEXT)
- is_active (BOOLEAN)
```

### Tabla: codes (códigos escaneados)
```sql
- id (UUID)
- code (TEXT) - "56813890077"
- carrier_id (UUID) → carriers.id
- store_id (UUID) → stores.id
- operator_id (UUID) → operators.id
- raw_scan (TEXT) - QR/Barcode original completo
- scan_type (TEXT) - 'qr' | 'barcode' | 'manual'
- created_at (TIMESTAMP)
```

---

## 🔑 DIFERENCIAS CLAVE V1 vs V2

| Aspecto | V1 | V2 |
|---------|----|----|
| **Transportadoras** | Hardcoded en JS | Tabla en BD con config JSON |
| **Validación** | Código JavaScript fijo | Reglas dinámicas desde BD |
| **Extracción** | Lógica hardcoded | Configuración en extraction_config |
| **Tiendas** | Lista fija en componente | Tabla en BD con CRUD |
| **Agregar carrier** | Modificar código + deploy | INSERT en SQL |
| **Cambiar reglas** | Modificar JS + deploy | UPDATE en SQL |
| **Escalabilidad** | Limitada (2-3 carriers) | Ilimitada |

---

## 🚀 VENTAJAS DE V2

1. **Agregar transportadora SIN tocar código:**
```sql
INSERT INTO carriers (name, code, display_name, validation_rules, extraction_config)
VALUES (
  'Servientrega',
  'servientrega',
  'Servientrega',
  '{"pattern": "starts_with_SER", "min_length": 10}'::jsonb,
  '{"method": "substring", "start": 0, "length": 12}'::jsonb
);
```

2. **Cambiar reglas SIN deploy:**
```sql
UPDATE carriers 
SET validation_rules = '{"pattern": "ends_with_001", "min_length": 25}'::jsonb
WHERE code = 'coordinadora';
```

3. **Desactivar transportadora:**
```sql
UPDATE carriers SET is_active = false WHERE code = 'coordinadora';
```

---

## 🎯 CREDENCIALES SUPABASE

**Archivo:** `.env`
```env
VITE_SUPABASE_URL=https://aejbpjvufpyxlvitlvfn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamJwanZ1ZnB5eGx2aXRsdmZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzE2ODUsImV4cCI6MjA4MDcwNzY4NX0.Ek2zjIn3djbRKvzjqW9ju56PPb1vN2-M3ckVV5Jz5hs
```

---

## 📝 ORDEN DE MIGRACIÓN RECOMENDADO

**Para el asistente Claude Code en VS Code:**

1. **Primero actualizar servicios** (`src/services/supabase.js`)
   - Esto es la base de todo

2. **Luego validadores** (`src/utils/validators.js`)
   - Dependen de los servicios

3. **Después hooks** (`src/hooks/useScanner.js` y `useRealtime.js`)
   - Dependen de servicios y validadores

4. **Finalmente componentes** (`src/components/Dashboard.jsx`)
   - Solo cambiar import de StoreSelector

5. **Probar** en localhost:5173

---

## 🧪 CÓMO PROBAR QUE FUNCIONA

1. **Login:** Ingresa nombre (ej: "Daniel")
2. **Dashboard:** Debe cargar sin errores
3. **Click "Seleccionar tienda":** Debe mostrar 5 tiendas desde la BD
4. **Seleccionar tienda:** Ej: "Dunamixfy"
5. **Click "Escanear Códigos":** Abre scanner
6. **Escanear código válido:** 
   - Coordinadora: `70020222800020000356813890077001`
   - Interrápidisimo: `240041585918`
7. **Verificar en Supabase:**
   - Table Editor → `codes`
   - Debe aparecer con `carrier_id`, `store_id`, `operator_id`

---

## 🐛 ERRORES COMUNES Y SOLUCIONES

### Error: "carrier_id is required"
**Causa:** No se detectó la transportadora
**Solución:** Verificar que carriers están cargados en useScanner

### Error: "Cannot read properties of undefined (reading 'name')"
**Causa:** Servicios no actualizados
**Solución:** Verificar que supabase.js usa la versión V2

### Error: "validation_rules is not defined"
**Causa:** validators.js no actualizado
**Solución:** Usar validators-v2.js

### Error: Tiendas no aparecen en selector
**Causa:** Dashboard usa StoreSelector viejo
**Solución:** Cambiar import a StoreSelectorV2

---

## 💡 PRÓXIMOS PASOS DESPUÉS DE MIGRACIÓN

1. **Panel de Administración:**
   - CRUD de transportadoras
   - CRUD de tiendas
   - Gestión de operarios

2. **Dashboard Avanzado:**
   - Gráficos con Recharts
   - Comparativas por transportadora
   - Tendencias por tienda

3. **Features Adicionales:**
   - Exportar reportes (Excel, PDF)
   - Webhooks para integraciones
   - API REST

4. **App Móvil:**
   - React Native o Flutter
   - PWA mejorado

---

## 📞 CONTACTO CON DANIEL

- Proyecto: Dunamix - E-commerce COD
- Productos: RODILLAX, LUMBRAX (geles para dolor)
- Mercados: Colombia, México
- Operación: Call centers con closers

---

## ✅ CHECKLIST DE MIGRACIÓN

### ✅ MIGRACIÓN COMPLETADA - Diciembre 7, 2024

- [x] Actualizar `src/services/supabase.js` ✅ **COMPLETADO**
  - ✅ Agregado carriersService con comentarios explicativos detallados
  - ✅ Agregado storesService con comentarios explicativos detallados
  - ✅ Actualizado operatorsService con is_active
  - ✅ Actualizado codesService para usar codes_detailed
  - ✅ getTodayStats() ahora usa byCarrier dinámico

- [x] Actualizar `src/utils/validators.js` ✅ **COMPLETADO**
  - ✅ Función validateCode() con validación dinámica desde BD
  - ✅ Función extractCode() con configuración desde extraction_config
  - ✅ Función procesarCodigoConCarriers() valida contra N transportadoras
  - ✅ Función detectScanType() para detectar QR vs Barcode
  - ✅ Comentarios explicativos paso a paso en cada función

- [x] Actualizar `src/hooks/useScanner.js` ✅ **COMPLETADO**
  - ✅ Carga transportadoras dinámicamente desde BD al montar
  - ✅ Usa procesarCodigoConCarriers() para validación dinámica
  - ✅ Guarda carrier_id, store_id, raw_scan y scan_type
  - ✅ Retorna carriers, isLoadingCarriers y reloadCarriers
  - ✅ Comentarios explicativos del flujo completo

- [x] Actualizar `src/hooks/useRealtime.js` ✅ **COMPLETADO**
  - ✅ Compatible con codes_detailed (extrae solo campo 'code')
  - ✅ Transformación de stats de byCarrier dinámico a formato store
  - ✅ Comentarios explicativos de la transformación V2

- [x] Actualizar `src/components/Dashboard.jsx` (import) ✅ **COMPLETADO**
  - ✅ Cambiado import de StoreSelector a StoreSelectorV2
  - ✅ Actualizado StoreSelectorV2 para usar supabase.js (migrado)

### 🧪 PRUEBAS PENDIENTES

- [x] Probar login ✅
- [x] Probar selector de tienda (carga desde BD) ✅
- [ ] Probar escaneo de código desde celular (debe validar contra carriers desde BD)
- [ ] Verificar en Supabase Table Editor (carrier_id, store_id, scan_type)
- [ ] Confirmar tiempo real funciona
- [ ] Probar estadísticas (byCarrier dinámico)
- [ ] Probar historial

### 📱 CONFIGURACIÓN HTTPS PARA CÁMARA EN RED LOCAL

**Problema detectado:**
- ❌ Error `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` en PC e iPhone
- Los certificados autofirmados básicos no eran compatibles

**Causa:** Los navegadores requieren HTTPS con certificados válidos para acceder a la cámara

**Solución aplicada:** ✅ **Instalado `vite-plugin-mkcert`**
- Genera certificados SSL confiables automáticamente
- Elimina advertencias de seguridad en PC
- Compatible con todos los navegadores

**Archivo de referencia:** Ver [SOLUCION_HTTPS.md](SOLUCION_HTTPS.md)

**Pasos para usar desde celular:**
1. Reiniciar servidor: `npm run dev`
2. Abrir `https://192.168.68.110:5173` (con HTTPS)
3. **Primera vez:** Aceptar certificado (o instalar CA raíz para eliminar advertencias)
4. Permitir acceso a cámara
5. ¡Escanear códigos! 📷

---

## 🎯 OBJETIVO FINAL

Sistema de scanner QR/Barcode **100% escalable** donde:
- ✅ Agregar transportadoras = SQL INSERT (sin código)
- ✅ Modificar reglas = SQL UPDATE (sin código)
- ✅ Gestionar tiendas = CRUD desde UI
- ✅ Todo en tiempo real
- ✅ Sin límites de crecimiento

---

## 🚀 COMANDOS ÚTILES

```bash
# Ejecutar en desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 DOCUMENTACIÓN ADICIONAL

- **README-V2.md:** Documentación completa del proyecto
- **supabase-schema-v2.sql:** Schema completo de la BD
- **Supabase Dashboard:** https://supabase.com/dashboard/project/aejbpjvufpyxlvitlvfn

---

## 📋 RESUMEN DE LA MIGRACIÓN V2

### Archivos Migrados (5 archivos principales):

1. **`src/services/supabase.js`**
   - Agregados 3 nuevos servicios: carriersService, storesService (mejorado operatorsService)
   - Cada servicio tiene comentarios explicativos detallados
   - getTodayStats() ahora genera byCarrier dinámicamente

2. **`src/utils/validators.js`**
   - 4 funciones principales con validación dinámica
   - Comentarios explicativos de cada método de extracción
   - Documentación de estructuras de datos

3. **`src/hooks/useScanner.js`**
   - Carga carriers desde BD al montar
   - Guarda campos adicionales: carrier_id, store_id, raw_scan, scan_type
   - Comentarios paso a paso del flujo completo

4. **`src/hooks/useRealtime.js`**
   - Compatible con codes_detailed
   - Transformación de stats para compatibilidad
   - Extracción eficiente solo del campo 'code'

5. **`src/components/Dashboard.jsx` + `StoreSelectorV2.jsx`**
   - Import actualizado a StoreSelectorV2
   - Carga tiendas dinámicamente desde BD

### Ventajas Conseguidas:

✅ **Escalabilidad Ilimitada:** Agregar transportadoras vía SQL INSERT
✅ **Configuración Dinámica:** Cambiar reglas sin deploy
✅ **Código Documentado:** Comentarios explicativos en cada archivo
✅ **Relaciones Normalizadas:** carrier_id, store_id, operator_id
✅ **Trazabilidad:** raw_scan y scan_type para analytics

### Próximo Paso:

🚀 **Probar la aplicación** en `localhost:5173` y verificar que todo funciona correctamente.

---

**FECHA DE ESTE CONTEXTO:** Diciembre 7, 2024
**ESTADO DEL PROYECTO:** ✅ Migración V1 → V2 COMPLETADA
**PRÓXIMO PASO:** Probar la aplicación y verificar funcionalidad
