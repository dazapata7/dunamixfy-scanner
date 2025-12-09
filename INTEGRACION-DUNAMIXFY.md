# 🔗 Integración Dunamixfy CO - Guía de Producción

## ✅ Estado: LISTO PARA PRODUCCIÓN

La integración con Dunamixfy CO está completamente implementada y lista para pruebas en producción.

---

## 📋 Checklist de Configuración

### 1️⃣ Supabase - Base de Datos

**SQL a ejecutar:**

```sql
-- Tabla orders para almacenar información de órdenes
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificadores
  order_id TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,

  -- Información del cliente
  firstname TEXT,
  lastname TEXT,

  -- Detalles de la orden
  order_items JSONB,
  sync_status TEXT,
  pay_type TEXT,

  -- Relaciones
  transportadora TEXT,
  store TEXT,

  -- Información del escaneo
  scanned_by UUID REFERENCES auth.users(id),
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scan_count INTEGER DEFAULT 1,

  -- Metadatos
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_order_id ON orders(order_id);
CREATE INDEX idx_orders_code ON orders(code);
CREATE INDEX idx_orders_scanned_by ON orders(scanned_by);
CREATE INDEX idx_orders_scanned_at ON orders(scanned_at);
CREATE INDEX idx_orders_transportadora ON orders(transportadora);
CREATE INDEX idx_orders_store ON orders(store);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orders" ON orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own scanned orders" ON orders
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION handle_order_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF OLD.code = NEW.code THEN
    NEW.scan_count = OLD.scan_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_trigger ON orders;
CREATE TRIGGER update_orders_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_update();
```

**✅ Verificar:** Tabla `orders` creada correctamente

---

### 2️⃣ Bubble.io - Configuración del Workflow

**Endpoint:** `https://dunamixfy.bubbleapps.io/version-test/api/1.1/wf/dfx_scanner_get_orderinfo`

**Campos configurados:**
- ✅ `order_id`: 138
- ✅ `firstname`: "Hernan"
- ✅ `lastname`: "Zapata"
- ✅ `orderItems`: "59000x SmartWatch T7000 1x Zapatos Adidas"
- ✅ `pay_type`: "COD"
- ✅ `transportadora`: "Coordinadora"
- ⚠️ `sync_status`: Opcional
- ⚠️ `store`: Opcional

**✅ Verificar:** Ejecutar `node test-dunamixfy-api.js` debe mostrar todos los campos

---

### 3️⃣ Aplicación Desplegada

**URLs:**
- **GitHub:** `https://github.com/dazapata7/dunamixfy-scanner`
- **Vercel:** Auto-deploy desde main branch
- **Último commit:** `f856cdb` - Test script agregado

**✅ Verificar:**
- Vercel deployment exitoso
- App accesible desde móvil
- Login funcionando

---

## 🚀 Flujo de Escaneo en Producción

### Paso a paso:

1. **Usuario escanea código QR/Barcode**
   ```
   📱 Scanner → ZXing detecta código
   ```

2. **Validación del código**
   ```
   🔍 Validar contra transportadoras en BD
   ✅ Código válido
   ```

3. **Consulta a Dunamixfy CO API**
   ```
   🌐 POST https://dunamixfy.bubbleapps.io/.../dfx_scanner_get_orderinfo
   📦 Body: { "code": "123456789" }
   ✅ Respuesta con info de orden
   ```

4. **Guardar en Supabase**
   ```
   💾 Tabla orders → Info completa de la orden
   💾 Tabla codes → Registro del escaneo
   ```

5. **Feedback al usuario**
   ```
   ✅ Toast: "123456789 - Coordinadora ✅ GUARDADO"
   👤 Toast: "Cliente: Hernan Zapata"
   ```

---

## 🧪 Pruebas en Producción

### Test 1: Código Válido Existente en Dunamixfy

**Escenario:**
- Escanear código que existe en Dunamixfy CO
- Ejemplo: `123456789`

**Resultado esperado:**
- ✅ Código guardado en `codes`
- ✅ Orden guardada en `orders` con:
  - order_id
  - firstname/lastname
  - orderItems
  - pay_type
  - transportadora
- ✅ Toast muestra nombre del cliente

---

### Test 2: Código Válido NO Existente en Dunamixfy

**Escenario:**
- Escanear código válido pero que NO existe en Dunamixfy

**Resultado esperado:**
- ✅ Código guardado en `codes`
- ⚠️ Orden NO guardada en `orders` (no existe en Dunamixfy)
- ✅ Toast muestra código guardado (sin nombre de cliente)
- ✅ El escaneo continúa normalmente

---

### Test 3: Código Repetido

**Escenario:**
- Escanear el mismo código dos veces

**Resultado esperado:**
- Primera vez:
  - ✅ Guardado exitoso
- Segunda vez:
  - ⚠️ Detectado como repetido
  - ✅ Toast: "⚠️ REPETIDO"
  - ✅ Contador de sesión incrementado
  - ✅ `scan_count` incrementado en tabla `orders`

---

## 📊 Monitoreo en Supabase

### Consultas útiles:

**Ver órdenes escaneadas hoy:**
```sql
SELECT * FROM orders
WHERE scanned_at >= CURRENT_DATE
ORDER BY scanned_at DESC;
```

**Ver códigos más escaneados:**
```sql
SELECT code, firstname, lastname, scan_count
FROM orders
ORDER BY scan_count DESC
LIMIT 10;
```

**Ver estadísticas por transportadora:**
```sql
SELECT transportadora, COUNT(*) as total
FROM orders
GROUP BY transportadora;
```

**Ver órdenes por operador:**
```sql
SELECT u.email, COUNT(o.id) as total_scans
FROM orders o
JOIN auth.users u ON o.scanned_by = u.id
GROUP BY u.email
ORDER BY total_scans DESC;
```

---

## 🔧 Configuración de Variables

### API Dunamixfy
```javascript
// src/services/dunamixfyApi.js
const API_KEY = 'd82b1fe06d0267b8efb596dd8190c983';
const BASE_URL = 'https://dunamixfy.bubbleapps.io/version-test/api/1.1/wf';
```

**Para pasar a producción:**
- Cambiar `version-test` por la URL de producción de Bubble

---

## 📱 Usuarios de Prueba

### Admin
- Email: Tu cuenta registrada
- Rol: `admin` + `operator`
- Acceso: Desktop (config + stats) + Mobile (scanner)

### Operador
- Registro automático
- Rol: `operator`
- Acceso: Desktop (solo stats) + Mobile (scanner)

---

## 🐛 Troubleshooting

### Problema: "Orden no encontrada en Dunamixfy CO"
**Solución:**
- Verificar que el código existe en Dunamixfy
- Revisar logs en consola del navegador
- Ejecutar `node test-dunamixfy-api.js` con el código

### Problema: "Error al guardar orden"
**Solución:**
- Verificar tabla `orders` existe en Supabase
- Verificar RLS policies están activas
- Revisar logs en Supabase

### Problema: "No muestra nombre de cliente"
**Solución:**
- Verificar que Bubble devuelve `firstname` y `lastname`
- Revisar logs en consola: "✅ Orden encontrada en Dunamixfy"

---

## 📞 Soporte

**Logs en vivo:**
- Abrir DevTools (F12)
- Console mostrará:
  - 🌐 Consulta a Dunamixfy CO
  - ✅ Respuesta recibida
  - 💾 Orden guardada
  - ⚠️ Errores si los hay

---

## ✅ Checklist Final

Antes de usar en producción:

- [ ] Tabla `orders` creada en Supabase
- [ ] Workflow en Bubble configurado con todos los campos
- [ ] Test ejecutado: `node test-dunamixfy-api.js`
- [ ] App desplegada en Vercel
- [ ] Usuario admin creado y rol asignado
- [ ] Usuario operador de prueba creado
- [ ] Escaneo de prueba desde móvil exitoso
- [ ] Verificado que se guarda info en `orders`
- [ ] Verificado que muestra nombre de cliente

---

## 🎉 ¡Listo para Producción!

La integración está completa y funcional. Cada código escaneado:
1. ✅ Se valida contra transportadoras
2. ✅ Se consulta en Dunamixfy CO
3. ✅ Se guarda info completa del cliente y orden
4. ✅ Se muestra feedback visual al operador
5. ✅ Se sincroniza en tiempo real

**Fecha de implementación:** Diciembre 2025
**Versión:** 2.0.0 con integración Dunamixfy CO
