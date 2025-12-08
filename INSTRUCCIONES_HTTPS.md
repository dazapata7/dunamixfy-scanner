# 📱 SOLUCIÓN: Cámara no funciona desde IP local (192.168.68.110)

## 🔍 Problema Identificado

Los navegadores modernos **requieren HTTPS** para acceder a la cámara por razones de seguridad.

- ✅ `http://localhost:5173` → Funciona (localhost es considerado seguro)
- ❌ `http://192.168.68.110:5173` → NO funciona (HTTP desde IP no es seguro)
- ✅ `https://192.168.68.110:5173` → Funcionará (HTTPS es seguro)

---

## ✅ SOLUCIÓN APLICADA

He habilitado **HTTPS automático en Vite**. Ahora el servidor generará certificados autofirmados.

**Cambio realizado en `vite.config.js`:**
```javascript
server: {
  port: 5173,
  host: true,
  https: true  // ← NUEVO: Habilita HTTPS
}
```

---

## 🚀 PASOS PARA USAR LA CÁMARA DESDE TU CELULAR

### 1. Reiniciar el servidor de desarrollo

```bash
# Detener el servidor actual (Ctrl+C)
# Luego reiniciar:
npm run dev
```

Verás algo como:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   https://localhost:5173/
➜  Network: https://192.168.68.110:5173/
```

**Nota:** Ahora es `https://` en lugar de `http://`

---

### 2. Abrir desde tu celular

En tu celular, abre el navegador (Chrome/Safari) y accede a:

```
https://192.168.68.110:5173/
```

---

### 3. Aceptar el certificado autofirmado

Como el certificado es autofirmado (no oficial), el navegador mostrará una advertencia de seguridad:

#### En Chrome (Android/iOS):
1. Verás: **"Tu conexión no es privada"** o **"Not Secure"**
2. Click en **"Opciones avanzadas"** o **"Advanced"**
3. Click en **"Continuar a 192.168.68.110 (no seguro)"** o **"Proceed to..."**

#### En Safari (iOS):
1. Verás: **"Esta conexión no es privada"**
2. Click en **"Mostrar detalles"**
3. Click en **"visitar este sitio web"**
4. Confirma con **"Visitar sitio web"**

---

### 4. Permitir acceso a la cámara

Cuando abras el Scanner, el navegador pedirá permiso:

1. Aparecerá: **"Dunamix Scanner quiere usar tu cámara"**
2. Click en **"Permitir"** o **"Allow"**

¡Listo! 📷 La cámara debería funcionar perfectamente.

---

## 🔧 SOLUCIÓN ALTERNATIVA: Certificado SSL Válido (Opcional)

Si no quieres aceptar la advertencia cada vez, puedes usar **mkcert** para generar certificados locales confiables:

### Instalación de mkcert:

#### Windows (con Chocolatey):
```bash
choco install mkcert
```

#### Windows (manual):
1. Descargar desde: https://github.com/FiloSottile/mkcert/releases
2. Renombrar a `mkcert.exe`
3. Agregar al PATH

### Configuración:

```bash
# 1. Instalar CA local
mkcert -install

# 2. Generar certificados para tu IP
cd c:\Users\dazap\Desarrollos\dunamix-scanner
mkcert localhost 127.0.0.1 192.168.68.110

# Esto creará:
# - localhost+2.pem (certificado)
# - localhost+2-key.pem (llave privada)
```

### Actualizar vite.config.js:

```javascript
import fs from 'fs'
import path from 'path'

export default defineConfig({
  // ... resto de config
  server: {
    port: 5173,
    host: true,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'localhost+2-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'localhost+2.pem'))
    }
  }
})
```

Con esto **NO verás advertencias** en ningún dispositivo conectado a tu red.

---

## 📊 COMPARACIÓN DE OPCIONES

| Opción | Ventajas | Desventajas |
|--------|----------|-------------|
| **Vite HTTPS simple** (actual) | ✅ Fácil (1 línea)<br>✅ Automático | ⚠️ Advertencia en navegador (1 vez) |
| **mkcert** | ✅ Sin advertencias<br>✅ Certificados válidos | ⚠️ Requiere instalación extra |
| **Túnel (ngrok, localtunnel)** | ✅ HTTPS público<br>✅ URL compartible | ⚠️ Latencia<br>⚠️ Internet requerido |

---

## 🧪 VERIFICACIÓN

Para confirmar que funciona:

1. **En PC (localhost):**
   - `https://localhost:5173` ✅ Debe funcionar

2. **En celular (red local):**
   - `https://192.168.68.110:5173` ✅ Debe funcionar (después de aceptar certificado)

3. **Probar scanner:**
   - Login → Seleccionar tienda → Escanear códigos
   - La cámara debe abrir y detectar códigos QR/Barcode

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema: "ERR_SSL_PROTOCOL_ERROR"
**Solución:** Asegúrate de usar `https://` (con "s") en la URL

### Problema: "No puedo aceptar el certificado"
**Solución en Chrome Android:**
1. Escribe: `chrome://flags/#allow-insecure-localhost`
2. Habilita la opción
3. Reinicia Chrome

### Problema: La cámara no abre después de aceptar
**Solución:**
1. Verifica permisos del navegador:
   - Android: Configuración → Aplicaciones → Chrome → Permisos → Cámara ✅
   - iOS: Ajustes → Safari → Cámara ✅
2. Recargar la página (F5)
3. Probar en modo incógnito

---

## 📝 NOTAS IMPORTANTES

- ✅ **HTTPS es OBLIGATORIO** para usar cámara desde red local
- ✅ El certificado autofirmado es **seguro para desarrollo local**
- ✅ Solo necesitas aceptar la advertencia **una vez por sesión**
- ✅ Todos los dispositivos en tu red local (`192.168.68.x`) podrán acceder

---

## 🎯 RESUMEN

**Ya está configurado!** Solo necesitas:

1. ✅ Reiniciar servidor: `npm run dev`
2. ✅ Abrir en celular: `https://192.168.68.110:5173`
3. ✅ Aceptar certificado autofirmado
4. ✅ Permitir acceso a cámara
5. ✅ ¡Escanear códigos! 📷

---

**Fecha:** Diciembre 7, 2024
**Estado:** ✅ Configurado y listo para usar
