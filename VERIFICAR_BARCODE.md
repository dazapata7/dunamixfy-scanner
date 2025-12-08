# 🔍 VERIFICACIÓN BARCODE - Interrápidisimo

## ✅ MEJORAS APLICADAS AL SCANNER

### 1. **Scan cooldown** ✅
- Previene escaneos duplicados rápidos
- Ignora el mismo código si se escanea en menos de 3 segundos
- FPS reducido de 10 a 5 para más estabilidad

### 2. **Feedback visual** ✅
- Borde verde cuando se guarda correctamente
- Borde rojo cuando es código repetido
- Transición animada de 300ms

### 3. **Feedback de audio** ✅
- Beep agudo (800Hz) para código guardado
- Beep grave (200Hz) para código repetido

### 4. **Feedback háptico** ✅
- Vibración corta (100ms) para éxito
- Vibración larga pulsada (200-100-200ms) para error

### 5. **Área de scanner optimizada** ✅
- Reducida altura con aspectRatio 1.333 (4:3)
- Qrbox rectangular (60% ancho, 70% altura relativa)
- Mejor para códigos de barras

### 6. **Soporte mejorado para barcodes** ✅
- Agregado `formatsToSupport`:
  - 0 = QR_CODE
  - 8 = CODE_128 (Coordinadora)
  - 13 = EAN_13 (Interrápidisimo)

---

## 🐛 PROBLEMA BARCODE - Diagnóstico

Si los barcodes de Interrápidisimo muestran "código erróneo", verifica:

### **1. Verificar reglas en Supabase**

**En Supabase → Table Editor → carriers → Interrápidisimo:**

```json
{
  "pattern": "starts_with_24",
  "length": [12, 13],
  "digits_only": true
}
```

**Problema común:**
- Si el barcode tiene exactamente 12 dígitos pero la regla pide 13, fallará
- Si el barcode NO empieza con "24", fallará

### **2. Verificar extraction_config**

```json
{
  "method": "substring",
  "start": 0,
  "length": 12
}
```

**Esto significa:**
- Si el código tiene 13 dígitos → extrae los primeros 12
- Si tiene 12 dígitos → se queda igual

### **3. Probar con logs detallados**

Cuando escanees un barcode de Interrápidisimo, verás en la consola Eruda:

```
🔍 Código detectado: 240041585918
📋 Validando código contra carriers...
  ✅ Coordinadora: NO (no termina con 001)
  ✅ Interrápidisimo: SÍ
📦 Código procesado: {
  valido: true,
  codigo: "240041585918",
  carrierName: "Interrápidisimo"
}
```

**Si dice "código erróneo":**

```
🔍 Código detectado: 340041585918  <- No empieza con 24!
📋 Validando código contra carriers...
  ❌ Coordinadora: NO
  ❌ Interrápidisimo: NO (no empieza con 24)
⚠️ Código no válido: Código no válido o transportadora no reconocida
```

---

## 🧪 PRUEBAS RECOMENDADAS

### **Caso 1: Barcode de 12 dígitos**

Ejemplo: `240041585918`

**Debería:**
1. Scanner detecta el código
2. Validador: `starts_with_24` ✅, `length: [12, 13]` ✅, `digits_only` ✅
3. Extractor: `substring(0, 12)` = `240041585918` (sin cambios)
4. Guardar en BD

### **Caso 2: Barcode de 13 dígitos**

Ejemplo: `2400415859181`

**Debería:**
1. Scanner detecta el código
2. Validador: `starts_with_24` ✅, `length: [12, 13]` ✅, `digits_only` ✅
3. Extractor: `substring(0, 12)` = `240041585918` (trunca último dígito)
4. Guardar en BD

### **Caso 3: Barcode inválido**

Ejemplo: `340041585918` (no empieza con 24)

**Debería:**
1. Scanner detecta el código
2. Validador: `starts_with_24` ❌
3. Muestra "código erróneo"

---

## 🔧 SOLUCIÓN SI NO FUNCIONA

### **Opción A: Ajustar reglas en Supabase**

Si tus barcodes de Interrápidisimo no empiezan con "24":

```sql
UPDATE carriers
SET validation_rules = '{
  "length": [12, 13],
  "digits_only": true
}'::jsonb
WHERE code = 'interrapidisimo';
```

Esto permite **cualquier** código de 12-13 dígitos numéricos.

### **Opción B: Agregar más patrones**

Si hay varios formatos de Interrápidisimo:

```sql
UPDATE carriers
SET validation_rules = '{
  "pattern": "multiple",
  "patterns": ["starts_with_24", "starts_with_34"],
  "length": [12, 13],
  "digits_only": true
}'::jsonb
WHERE code = 'interrapidisimo';
```

Luego actualizar `validators.js` para soportar `pattern: "multiple"`.

### **Opción C: Temporalmente permitir todo**

Para depurar rápidamente:

```sql
UPDATE carriers
SET validation_rules = '{}'::jsonb
WHERE code = 'interrapidisimo';
```

Esto acepta **cualquier** código para Interrápidisimo (útil solo para pruebas).

---

## 📱 CÓMO PROBAR AHORA

1. **Reiniciar servidor:**
   ```bash
   npm run dev
   ```

2. **Abrir en iPhone:**
   ```
   https://192.168.68.110:5173
   ```

3. **Login → Seleccionar tienda → Escanear**

4. **Escanear un código QR de Coordinadora:**
   - Debería: Borde verde, beep agudo, vibración corta, "✅ GUARDADO"

5. **Escanear el mismo código:**
   - Debería: Borde rojo, beep grave, vibración larga, "⚠️ REPETIDO"

6. **Escanear un barcode de Interrápidisimo:**
   - Si funciona: Borde verde, beep, vibración, "✅ GUARDADO"
   - Si falla: Abrir consola Eruda y copiar el log del error

---

## 🎯 RESUMEN DE CAMBIOS

| Característica | Antes | Ahora |
|---------------|-------|-------|
| FPS | 10 | 5 (más estable) |
| Área de escaneo | Cuadrado 250x250 | Rectangular adaptable (60% ancho, 70% altura) |
| AspectRatio | 1.0 (cuadrado) | 1.333 (4:3, menos alto) |
| Feedback visual | ❌ No | ✅ Borde verde/rojo |
| Feedback audio | ❌ No | ✅ Beep éxito/error |
| Feedback háptico | ❌ No | ✅ Vibración |
| Cooldown duplicados | ❌ No | ✅ 3 segundos |
| Formatos soportados | Auto | QR_CODE, CODE_128, EAN_13 |

---

**Fecha:** Diciembre 7, 2024
**Estado:** ✅ Mejoras aplicadas, esperando pruebas de barcode
