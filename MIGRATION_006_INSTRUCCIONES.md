# 🔄 Migración 006: Trazabilidad de Primer Escaneo

## ⚠️ IMPORTANTE - EJECUTAR ANTES DE USAR EL SISTEMA

Esta migración agrega campos críticos para la trazabilidad de escaneos de guías.

## 📋 Qué hace esta migración:

1. **Agrega campos a `dispatches`:**
   - `first_scanned_at` - Fecha/hora del primer escaneo
   - `first_scanned_by` - Operador que hizo el primer escaneo

2. **Crea trigger automático:**
   - Auto-marca `first_scanned_at` al crear dispatch con guía

3. **Crea vista `dispatch_scan_history`:**
   - Vista optimizada para el historial de escaneos
   - Incluye duración entre escaneo y confirmación
   - Datos del operador y transportadora

## 🚀 Cómo ejecutar:

### Opción 1: Supabase Dashboard (Recomendado)

1. Ir a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleccionar proyecto
3. Ir a **SQL Editor** en el menú lateral
4. Click en **+ New Query**
5. Copiar y pegar el contenido de `supabase/migrations/006_add_first_scan_tracking.sql`
6. Click en **Run** o presionar `Ctrl+Enter`
7. Verificar que diga "Success. No rows returned"

### Opción 2: Supabase CLI

```bash
# Asegurarse de estar en la raíz del proyecto
cd c:\Users\dazap\Desarrollos\dunamix-scanner

# Ejecutar migración
supabase db push
```

## ✅ Verificación:

Después de ejecutar la migración, verificar en **Database → Tables**:

**Tabla `dispatches` debe tener:**
- Columna `first_scanned_at` (timestamp)
- Columna `first_scanned_by` (uuid, FK a operators)

**Debe existir la vista:**
- `dispatch_scan_history`

Probar con SQL:
```sql
SELECT * FROM dispatch_scan_history LIMIT 5;
```

## 🎯 Beneficios:

- ✅ **Trazabilidad completa** de quién y cuándo se escaneó cada guía
- ✅ **Prevención de duplicados** con validación estricta
- ✅ **Historial detallado** en `/wms/history`
- ✅ **Métricas de desempeño** (tiempo entre escaneo y confirmación)
- ✅ **Auditoría** para cumplimiento

## 📊 Flujo de escaneo actualizado:

1. Usuario escanea guía → Se crea `dispatch` (draft)
2. `first_scanned_at` se marca automáticamente (trigger)
3. `first_scanned_by` registra al operador
4. Usuario confirma → Se marca `confirmed_at`
5. `shipment_record` se marca como PROCESSED
6. Todo queda registrado en `dispatch_scan_history`

---

**Ejecutar antes de:** Usar el módulo WMS en producción
**Fecha de creación:** 2026-02-05
**Versión:** WMS V1 - Fase 1
