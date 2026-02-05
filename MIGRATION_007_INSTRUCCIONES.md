# 📸 Migración 007: Fotos de Productos

## 📋 Qué hace esta migración:

1. **Agrega campo `photo_url` a `products`:**
   - Almacena URL de la foto principal del producto
   - Puede ser URL de Supabase Storage o URL externa

2. **Actualiza vista `inventory_stock_view`:**
   - Incluye el campo `photo_url` en la vista de inventario
   - Ahora el inventario muestra fotos de productos

## 🚀 Cómo ejecutar:

### Paso 1: Ejecutar SQL (Supabase Dashboard)

1. Ir a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleccionar proyecto
3. Ir a **SQL Editor**
4. Copiar y pegar el contenido de `supabase/migrations/007_add_product_photo.sql`
5. Click en **Run**

### Paso 2: Crear Bucket de Storage (Opcional)

Si quieres almacenar fotos en Supabase Storage:

1. Ir a **Storage** en el menú lateral
2. Click en **New Bucket**
3. Configurar:
   - **Name:** `product-photos`
   - **Public:** ✅ Activar (para que las fotos sean accesibles públicamente)
4. Click en **Create Bucket**

### Paso 3: Configurar Políticas de Storage (Opcional)

Para permitir subir fotos:

```sql
-- Permitir lectura pública
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos');

-- Permitir subida autenticada
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-photos' AND auth.role() = 'authenticated');
```

## ✅ Verificación:

Verificar que el campo exista:
```sql
SELECT photo_url FROM products LIMIT 1;
```

Verificar que la vista incluya photo_url:
```sql
SELECT product_id, sku, product_name, photo_url, qty_on_hand
FROM inventory_stock_view
LIMIT 5;
```

## 📝 Cómo agregar fotos a productos:

### Opción 1: URL Externa (Más simple)

Actualizar directamente con URL de imagen externa:
```sql
UPDATE products
SET photo_url = 'https://example.com/imagen-producto.jpg'
WHERE sku = 'ROD120';
```

### Opción 2: Subir a Supabase Storage

1. Ir a **Storage** → `product-photos`
2. Click en **Upload File**
3. Subir imagen del producto
4. Copiar URL pública de la imagen
5. Actualizar producto:
```sql
UPDATE products
SET photo_url = 'https://[PROJECT_REF].supabase.co/storage/v1/object/public/product-photos/rod120.jpg'
WHERE sku = 'ROD120';
```

### Opción 3: Desde Código (Futuro)

Más adelante se puede crear un formulario de administración de productos con subida de fotos.

## 🎨 Resultado Visual:

En la lista de inventario (`/wms/inventory`), cada producto ahora mostrará:

```
┌────────────────────────────────────┐
│ [📷 Foto]  ROD120    [Disponible] │
│            Rodillax 120ml          │
│            Barcode: 789456123      │
│                             45 uds │
└────────────────────────────────────┘
```

## 📊 Beneficios:

- ✅ **Identificación visual** rápida de productos
- ✅ **Menos errores** al escanear (verificación visual)
- ✅ **Mejor UX** para operadores de bodega
- ✅ **Referencia visual** al preparar despachos

## 🔄 Formato de Imagen Recomendado:

- **Formato:** JPG o PNG
- **Tamaño:** 500x500px (cuadrada)
- **Peso:** < 200KB
- **Nombre:** `{SKU}.jpg` (ej: `ROD120.jpg`)

---

**Ejecutar:** Antes de usar fotos en el inventario
**Fecha:** 2026-02-05
**Versión:** WMS V1 - Fase 1
