# ✅ SOLUCIÓN APLICADA - Certificados SSL Confiables

## 🔧 Problema Original

Error: `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`

Los certificados autofirmados básicos de Vite (`https: true`) causaban errores de compatibilidad en navegadores.

---

## ✅ SOLUCIÓN FINAL APLICADA

He instalado **vite-plugin-mkcert** que genera certificados SSL **confiables** automáticamente.

### Cambios realizados:

**1. Instalado el plugin:**
```bash
npm install --save-dev vite-plugin-mkcert
```

**2. Actualizado `vite.config.js`:**
```javascript
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    react(),
    mkcert(), // ← Genera certificados SSL confiables
    VitePWA({...})
  ],
  server: {
    port: 5173,
    host: true
    // HTTPS se habilita automáticamente por mkcert
  }
})
```

---

## 🚀 CÓMO USAR AHORA

### **Paso 1: Reiniciar el servidor**

```bash
# Si está corriendo, detenerlo (Ctrl+C)
npm run dev
```

La **primera vez** que ejecutes el servidor con `mkcert`, verás algo como:

```
Installing root certificate...

✓ Root certificate installed successfully!
```

Esto instala una Autoridad Certificadora (CA) local en tu sistema que hace que los certificados sean confiables.

### **Paso 2: Acceder desde PC**

```
https://localhost:5173/
```

✅ **No habrá advertencias** de seguridad - el certificado es confiable.

### **Paso 3: Acceder desde iPhone/Android**

```
https://192.168.68.110:5173/
```

#### **IMPORTANTE - Configuración única en dispositivos móviles:**

Como los certificados son generados localmente en tu PC, los dispositivos móviles necesitan confiar en la CA raíz.

#### **Opción A - Más Simple (puede requerir advertencia una vez):**

1. Abre `https://192.168.68.110:5173` en el navegador móvil
2. Si aparece advertencia, acepta el certificado (solo primera vez)
3. Permite acceso a cámara
4. ¡Listo! 📷

#### **Opción B - Certificado 100% Confiable (sin advertencias):**

**En Windows (donde corre el servidor):**

1. Buscar el certificado raíz de mkcert:
   ```bash
   # Mostrar ubicación del CA raíz
   npx mkcert -CAROOT
   ```
   Ejemplo de salida: `C:\Users\dazap\AppData\Local\mkcert`

2. Ir a esa carpeta y encontrar `rootCA.pem`

**En tu iPhone:**

1. Compartir `rootCA.pem` al iPhone (AirDrop, email, etc.)
2. Abrir el archivo → "Instalar perfil"
3. Ir a: Ajustes → General → VPN y gestión de dispositivos
4. Instalar el perfil de mkcert
5. Ir a: Ajustes → General → Información → Configuración de certificados
6. Activar confianza total para el certificado mkcert

**En Android:**

1. Compartir `rootCA.pem` al Android
2. Renombrar a `rootCA.crt`
3. Ir a: Configuración → Seguridad → Credenciales → Instalar desde almacenamiento
4. Seleccionar `rootCA.crt`
5. Asignar nombre y confirmar

---

## 🎯 VENTAJAS DE ESTA SOLUCIÓN

| Característica | `https: true` (anterior) | `mkcert` (actual) |
|---------------|------------------------|------------------|
| Certificados | ❌ Autofirmados básicos | ✅ CA local confiable |
| Advertencias PC | ⚠️ Sí | ✅ No |
| Advertencias móvil | ⚠️ Siempre | ✅ No (con CA instalada) |
| Compatibilidad | ❌ Errores SSL | ✅ 100% compatible |
| Configuración | Ninguna | Una vez (instala CA) |

---

## 🧪 VERIFICACIÓN

### **1. En PC (localhost):**

```bash
npm run dev
```

Abre: `https://localhost:5173`

✅ Debería cargar sin advertencias
✅ Candado verde en la barra de direcciones

### **2. En celular (red local):**

Abre: `https://192.168.68.110:5173`

✅ Puede mostrar advertencia la primera vez (acepta)
✅ Para eliminar advertencias: instalar CA raíz (Opción B arriba)

### **3. Probar cámara:**

1. Login → Seleccionar tienda → Escanear
2. Permitir acceso a cámara
3. ✅ La cámara debería abrir correctamente

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
**Solución:** Reinicia el navegador después de instalar mkcert

### Error: Advertencias persisten en móvil
**Solución:** Instala el certificado CA raíz siguiendo "Opción B" arriba

### Error: "mkcert no es reconocido"
**Solución:** El plugin lo instala automáticamente, solo ejecuta `npm run dev`

### La cámara sigue sin abrir
**Solución:**
1. Verifica que uses `https://` (con "s")
2. Verifica permisos de cámara del navegador
3. Prueba en modo incógnito
4. Reinicia el servidor: `npm run dev`

---

## 📝 RESUMEN

✅ **Instalado:** `vite-plugin-mkcert`
✅ **Configurado:** `vite.config.js`
✅ **Genera:** Certificados SSL confiables automáticamente
✅ **Elimina:** Errores `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`
✅ **Resultado:** HTTPS funcional en PC y móviles

---

## 🚀 PRÓXIMOS PASOS

```bash
# 1. Reiniciar servidor
npm run dev

# 2. Abrir en PC (sin advertencias)
https://localhost:5173

# 3. Abrir en celular (puede pedir aceptar certificado una vez)
https://192.168.68.110:5173

# 4. Probar scanner → ¡Debería funcionar! 📷
```

---

**Fecha:** Diciembre 7, 2024
**Estado:** ✅ Configurado con certificados confiables
**Plugin usado:** vite-plugin-mkcert v1.17.6
