# 🔍 DIAGNÓSTICO - Scanner no lee códigos

## 📋 SÍNTOMAS REPORTADOS

1. ✅ Cámara abre correctamente en iPhone
2. ❌ Dice "Cargando transportadoras" y no hace nada
3. ❌ No escanea códigos QR/Barcode
4. ❌ No guarda en base de datos

---

## 🔧 CAMBIOS APLICADOS PARA DIAGNÓSTICO

He agregado **logs de depuración detallados** para identificar el problema exacto:

### Archivos modificados:

1. **[Scanner.jsx](src/components/Scanner.jsx:11,14-20)**
   - Agregado estado visual de carga de transportadoras
   - Muestra cantidad de transportadoras cargadas
   - Muestra error si no se cargan

2. **[useScanner.js](src/hooks/useScanner.js:63-93)**
   - Logs detallados al cargar transportadoras
   - Muestra estructura completa de cada carrier
   - Captura errores con stack trace

---

## 🧪 PASOS DE DIAGNÓSTICO

### **1. Abrir consola del navegador en iPhone**

#### Desde Safari en iPhone:
1. **En Mac:** Safari → Desarrollar → [Tu iPhone] → [Tu página]
2. **En Windows:** No es posible directamente, usa la opción alternativa

#### Alternativa - Usar inspector remoto:
1. Instalar **Eruda** (consola móvil):

   Voy a agregarlo temporalmente al proyecto...

### **2. Verificar Supabase - Tabla `carriers`**

**IMPORTANTE:** Necesitas verificar que la tabla `carriers` tenga datos.

1. Ir a: https://supabase.com/dashboard/project/aejbpjvufpyxlvitlvfn
2. Click en **Table Editor** (menú izquierdo)
3. Seleccionar tabla **`carriers`**
4. Verificar que haya **2 registros activos:**
   - Coordinadora
   - Interrápidisimo

**Si la tabla está vacía, ejecutar este SQL:**

```sql
-- Insertar Coordinadora
INSERT INTO carriers (name, code, display_name, validation_rules, extraction_config, is_active)
VALUES (
  'Coordinadora',
  'coordinadora',
  'Coordinadora',
  '{"pattern": "ends_with_001", "min_length": 20}'::jsonb,
  '{"method": "slice", "start": -14, "end": -3}'::jsonb,
  true
);

-- Insertar Interrápidisimo
INSERT INTO carriers (name, code, display_name, validation_rules, extraction_config, is_active)
VALUES (
  'Interrápidisimo',
  'interrapidisimo',
  'Interrápidisimo',
  '{"pattern": "starts_with_24", "length": [12, 13], "digits_only": true}'::jsonb,
  '{"method": "substring", "start": 0, "length": 12}'::jsonb,
  true
);
```

---

## 🔴 PROBLEMAS POSIBLES Y SOLUCIONES

### **Problema 1: Tabla `carriers` vacía**

**Síntoma:** Mensaje "No se cargaron transportadoras"

**Solución:** Ejecutar el SQL de arriba en Supabase

---

### **Problema 2: Error de permisos RLS (Row Level Security)**

**Síntoma:** Error en consola: "permission denied for table carriers"

**Solución:** Desactivar RLS temporalmente en Supabase:

1. Ir a: Authentication → Policies
2. Seleccionar tabla `carriers`
3. Crear política pública para SELECT:

```sql
CREATE POLICY "Enable read access for all users" ON "public"."carriers"
FOR SELECT
USING (true);
```

O desactivar RLS completamente:

```sql
ALTER TABLE carriers DISABLE ROW LEVEL SECURITY;
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE operators DISABLE ROW LEVEL SECURITY;
ALTER TABLE codes DISABLE ROW LEVEL SECURITY;
```

---

### **Problema 3: Variable de entorno incorrecta**

**Síntoma:** Error "Falta configuración de Supabase"

**Solución:** Verificar archivo `.env`:

```env
VITE_SUPABASE_URL=https://aejbpjvufpyxlvitlvfn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlamJwanZ1ZnB5eGx2aXRsdmZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzE2ODUsImV4cCI6MjA4MDcwNzY4NX0.Ek2zjIn3djbRKvzjqW9ju56PPb1vN2-M3ckVV5Jz5hs
```

Después de editar `.env`, **reiniciar el servidor:**
```bash
npm run dev
```

---

### **Problema 4: CORS / Conexión bloqueada desde HTTPS**

**Síntoma:** Error de red o CORS en consola

**Solución:** Verificar que Supabase permita conexiones desde `https://192.168.68.110:5173`

En Supabase Dashboard:
1. Settings → API
2. Verificar que la URL del proyecto sea correcta
3. Si hay configuración de CORS, agregar: `https://192.168.68.110:5173`

---

## 📱 AGREGAR CONSOLA MÓVIL (Eruda)

Para ver logs en el iPhone directamente, voy a agregar Eruda...
