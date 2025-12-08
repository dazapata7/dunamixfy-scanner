# 🚀 Dunamix Scanner V2

Scanner QR/Barcode para control de entregas con **arquitectura escalable**

## ✨ Novedades V2

### **🎯 Base de Datos Normalizada**
- ✅ Tabla de **Transportadoras** (carriers) - configurables
- ✅ Tabla de **Tiendas** (stores) - CRUD completo
- ✅ Tabla de **Operarios** (operators) - mejorada
- ✅ **Reglas de validación dinámicas** (JSON)
- ✅ **Sin límites** - agrega transportadoras sin tocar código

### **🔧 Configuración Dinámica**
Cada transportadora tiene:
- **Reglas de validación** (patrón, longitud, etc.)
- **Configuración de extracción** (cómo obtener el código)
- **Estado activo/inactivo**

Ejemplo en la BD:
```json
{
  "validation_rules": {
    "pattern": "starts_with_24",
    "length": [12, 13],
    "digits_only": true
  },
  "extraction_config": {
    "method": "substring",
    "length": 12
  }
}
```

---

## 📋 Migración desde V1

### **Si YA tienes datos (ejecutar migration):**

```sql
-- Archivo: migration-v1-to-v2.sql
-- Crea las nuevas tablas sin afectar datos existentes
```

### **Si es instalación nueva:**

```sql
-- Archivo: supabase-schema-v2.sql
-- Schema completo con datos iniciales
```

---

## 🗄️ Estructura de Base de Datos

```
carriers (transportadoras)
├── id (UUID)
├── name (TEXT) - Nombre único
├── code (TEXT) - Código interno
├── display_name (TEXT) - Nombre para mostrar
├── validation_rules (JSONB) - Reglas de validación
├── extraction_config (JSONB) - Config de extracción
└── is_active (BOOLEAN)

stores (tiendas)
├── id (UUID)
├── name (TEXT) - Nombre único
├── code (TEXT) - Código interno opcional
├── description (TEXT)
└── is_active (BOOLEAN)

operators (operarios)
├── id (UUID)
├── name (TEXT) - Nombre único
├── email (TEXT)
├── phone (TEXT)
└── is_active (BOOLEAN)

codes (códigos escaneados)
├── id (UUID)
├── code (TEXT) - Código extraído
├── carrier_id (UUID) → carriers
├── store_id (UUID) → stores
├── operator_id (UUID) → operators
├── raw_scan (TEXT) - QR/Barcode original
├── scan_type (TEXT) - 'qr' | 'barcode' | 'manual'
└── created_at (TIMESTAMP)
```

---

## 🚀 Instalación

### 1. Instalar dependencias

```bash
cd dunamix-scanner
npm install
```

### 2. Configurar Supabase

#### Opción A: Instalación Nueva

1. Ve a **SQL Editor** en Supabase
2. Copia TODO el contenido de `supabase-schema-v2.sql`
3. Ejecuta (RUN)
4. Verifica que se crearon las tablas

#### Opción B: Migración desde V1

1. Ve a **SQL Editor** en Supabase
2. Copia el contenido de `migration-v1-to-v2.sql`
3. Ejecuta (RUN)
4. Verifica que no hubo errores

### 3. Configurar variables de entorno

Archivo `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-aqui
```

### 4. Ejecutar

```bash
npm run dev
```

---

## ➕ Agregar Nueva Transportadora

### Desde SQL Editor:

```sql
INSERT INTO carriers (name, code, display_name, validation_rules, extraction_config, is_active)
VALUES (
  'Servientrega',
  'servientrega',
  'Servientrega',
  '{
    "pattern": "starts_with_SE",
    "min_length": 10,
    "max_length": 15
  }'::jsonb,
  '{
    "method": "substring",
    "start": 0,
    "length": 12
  }'::jsonb,
  true
);
```

### Desde código (próximamente):

Panel de administración para gestionar transportadoras, tiendas y operarios.

---

## 📊 Vistas Disponibles

### `codes_detailed`
Códigos con joins a todas las tablas relacionadas:
```sql
SELECT * FROM codes_detailed 
WHERE created_at >= CURRENT_DATE;
```

### `dashboard_stats`
Estadísticas diarias agregadas:
```sql
SELECT * FROM dashboard_stats
ORDER BY date DESC
LIMIT 30;
```

---

## 🔍 Queries Útiles

### Ver todos los códigos con detalles
```sql
SELECT 
  c.code,
  carr.display_name as transportadora,
  s.name as tienda,
  o.name as operario,
  c.created_at
FROM codes c
LEFT JOIN carriers carr ON c.carrier_id = carr.id
LEFT JOIN stores s ON c.store_id = s.id
LEFT JOIN operators o ON c.operator_id = o.id
ORDER BY c.created_at DESC
LIMIT 100;
```

### Estadísticas por transportadora
```sql
SELECT 
  carr.display_name,
  COUNT(*) as total_codes,
  COUNT(DISTINCT DATE(c.created_at)) as days_active
FROM codes c
JOIN carriers carr ON c.carrier_id = carr.id
GROUP BY carr.id, carr.display_name
ORDER BY total_codes DESC;
```

### Estadísticas por tienda
```sql
SELECT 
  s.name,
  COUNT(*) as total_codes,
  COUNT(DISTINCT c.operator_id) as operators_used
FROM codes c
JOIN stores s ON c.store_id = s.id
GROUP BY s.id, s.name
ORDER BY total_codes DESC;
```

---

## 🎯 Ventajas de V2

| Feature | V1 | V2 |
|---------|----|----|
| **Transportadoras** | Hardcoded en código | Configurables en BD |
| **Agregar nueva** | Modificar código | INSERT en SQL |
| **Reglas de validación** | En JavaScript | En JSON (BD) |
| **Tiendas** | Lista fija | CRUD completo |
| **Escalabilidad** | Limitada | Ilimitada |
| **Mantenimiento** | Requiere deploy | Actualización en BD |
| **Admin Panel** | No | Sí (próximamente) |

---

## 🔄 Roadmap V2

- [x] Base de datos normalizada
- [x] Transportadoras dinámicas
- [x] Tiendas desde BD
- [ ] Panel de administración (CRUD)
- [ ] API REST para integraciones
- [ ] Webhooks para eventos
- [ ] Dashboard avanzado con gráficos
- [ ] Reportes personalizables
- [ ] Exportación a múltiples formatos
- [ ] App móvil nativa

---

## 🆘 Soporte

Para soporte técnico, contacta al desarrollador.

**Versión**: 2.0.0  
**Última actualización**: Diciembre 2024
