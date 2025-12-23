# 🚀 Dunamixfy Scanner

Scanner QR/Barcode para control de entregas con integración a Dunamixfy API

## ✨ Características

- 📱 Scanner QR y códigos de barras (ZXing - alta precisión)
- 🔄 Sincronización en tiempo real entre dispositivos
- ✅ Detección automática de duplicados (cache + BD)
- 📊 Dashboard con estadísticas avanzadas y reportes
- 🏢 Soporte para múltiples transportadoras dinámicas (BD)
- 💾 Base de datos PostgreSQL con Supabase
- 📴 Funciona offline (PWA con cola de sincronización)
- 📈 Exportar datos a CSV con filtros
- 🔐 Autenticación con Supabase Auth
- 🌐 Integración con Dunamixfy CO API
- ⚡ Validación pre-guardado para Coordinadora (can_ship)
- 🎨 UI Glassmorphism moderna y responsive
- #️⃣ Historial numerado para fácil referencia

## 🛠️ Tecnologías

- **React 18** - Framework UI
- **Vite** - Build tool ultra rápido
- **Supabase** - Backend as a Service (PostgreSQL + Auth + Realtime)
- **Zustand** - State management
- **Tailwind CSS** - Estilos con efectos glassmorphism
- **ZXing** - Scanner de códigos de barras optimizado
- **React Hot Toast** - Notificaciones
- **Workbox** - Service Worker para PWA offline-first

## 📋 Versiones

### V6 - Filtros Avanzados y Búsqueda (Actual)
- Sistema de filtros por transportadora y tienda
- Búsqueda en tiempo real (código, cliente, pedido, tienda)
- Exportación CSV con filtros aplicados
- Tabs reorganizados: Hoy, Historial, Transportadoras
- Numeración de códigos en listas (#1, #2, #3...)

### V5 - Autenticación y Sesiones
- Supabase Auth con email/password
- Sistema de roles (admin/operador)
- Gestión de sesiones de usuario
- Panel de configuración para admins
- Logout seguro con confirmación

### V4 - PWA Offline-First
- Service Worker con Workbox
- Cola de sincronización offline
- Auto-sync cuando regresa conexión
- Code-splitting por rutas
- Optimización de bundle

### V3 - Integración Dunamixfy API
- Consulta real-time a Dunamixfy CO
- Cache mínimo (order_id, customer_name, store_name)
- Validación can_ship para Coordinadora
- Interrapidisimo sin consulta API (más rápido)
- Retención 7 días con auto-limpieza

### V2 - Transportadoras Dinámicas
- Tabla `carriers` en BD
- Reglas de validación configurables
- Soporte para N transportadoras
- AdminPanel con gestión avanzada

### V1 - Base
- Scanner básico QR/Barcode
- Detección de duplicados
- Estadísticas en tiempo real

## 🚀 Instalación

### 1. Clonar/Descargar el proyecto

```bash
cd dunamix-scanner
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

#### 3.1 Crear proyecto en Supabase

1. Ve a https://supabase.com
2. Sign up / Login
3. Click "New Project"
4. Llena los datos:
   - Name: `dunamixfy-scanner`
   - Database Password: `[inventa uno seguro]`
   - Region: `South America (São Paulo)`
5. Click "Create new project" (tarda ~2 min)

#### 3.2 Crear las tablas

Ve a **SQL Editor** en Supabase y ejecuta el script de migración completo (ver archivo de migraciones).

#### 3.3 Configurar variables de entorno

1. En Supabase: **Project Settings** ⚙️ → **API**
2. Copia:
   - **Project URL**
   - **anon public** key

3. Crea archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

4. Edita `.env` y agrega tus credenciales:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-aqui
VITE_DUNAMIXFY_API_URL=https://api.dunamixfy.co
VITE_DUNAMIXFY_API_KEY=tu-api-key-dunamixfy
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:5173

## 📦 Build para Producción

```bash
npm run build
```

Los archivos optimizados estarán en `/dist`

## �� Deploy en Vercel

El proyecto está configurado para deploy automático en Vercel:

1. Push a `main` branch
2. Vercel detecta cambios y hace deploy automático
3. Configura las variables de entorno en Vercel Dashboard

## 🗂️ Estructura del Proyecto

```
dunamix-scanner/
├── src/
│   ├── components/              # Componentes de UI
│   │   ├── LoginAuth.jsx       # Login con Supabase Auth
│   │   ├── Dashboard.jsx       # Dashboard mobile
│   │   ├── DesktopDashboard.jsx # Dashboard desktop
│   │   ├── ZXingScanner.jsx    # Scanner con ZXing
│   │   ├── AdminPanel.jsx      # Panel admin con stats
│   │   └── ConfigPanel.jsx     # Configuración (admins)
│   ├── services/                # Servicios
│   │   ├── supabase.js         # Cliente Supabase
│   │   ├── dunamixfyApi.js     # API Dunamixfy
│   │   ├── offlineQueue.js     # Cola offline
│   │   └── syncService.js      # Auto-sync
│   ├── hooks/                   # Custom hooks
│   │   ├── useScanner.js       # Lógica de escaneo
│   │   ├── useRealtime.js      # Tiempo real Supabase
│   │   └── useAuth.jsx         # Autenticación
│   ├── store/                   # Estado global (Zustand)
│   │   └── useStore.js
│   ├── utils/                   # Utilidades
│   │   └── validators.js       # Validación transportadoras
│   ├── App.jsx
│   └── main.jsx
├── public/
│   ├── manifest.webmanifest    # PWA manifest
│   └── icons/                  # Iconos PWA
├── package.json
├── vite.config.js              # Config con PWA plugin
├── tailwind.config.js
└── .env
```

## 🔧 Flujo de Escaneo

### Coordinadora (con validación Dunamixfy)
1. Detectar código QR/Barcode
2. Validar formato según reglas en BD
3. Check cache local (rápido)
4. Check duplicado en BD
5. **Consultar Dunamixfy API** (tiempo real)
6. **Validar `can_ship`**:
   - Si `can_ship = NO`: Mostrar error, NO guardar
   - Si `can_ship = YES`: Guardar con datos del cliente
7. Mostrar feedback (verde/rojo)
8. Cooldown: 800ms (éxito) / 1500ms (error)

### Interrapidisimo (sin validación Dunamixfy)
1. Detectar código QR/Barcode
2. Validar formato según reglas en BD
3. Check cache local
4. Check duplicado en BD
5. **Guardar directamente** (más rápido, no consulta API)
6. Mostrar feedback
7. Cooldown: 800ms (éxito) / 1500ms (error)

## 📱 PWA (Progressive Web App)

La app se puede instalar en el teléfono:

1. Abre la URL en Chrome/Safari
2. Click en "Agregar a pantalla de inicio"
3. Funciona como app nativa
4. **Trabaja offline** con cola de sincronización automática

### Características Offline
- Códigos se guardan en `localStorage` cuando no hay conexión
- Auto-sync cuando regresa internet
- Indicador visual de modo offline (toast naranja)
- Queue persistente entre sesiones

## 🐛 Troubleshooting

### Error: "Missing Supabase configuration"
- Verifica que `.env` existe y tiene las variables correctas
- Reinicia el servidor de desarrollo

### Error al escanear
- Permite permisos de cámara en el navegador
- Usa HTTPS en producción (requerido para cámara)

### Los duplicados no se detectan
- Verifica que la tabla `codes` tiene el constraint `UNIQUE(code)`
- Revisa la consola del navegador para errores

### Códigos impresos no se leen
- El scanner usa ZXing con `TRY_HARDER` habilitado
- Asegúrate de buena iluminación
- Acerca el código a la cámara
- Verifica que el código impreso tiene buena calidad

### Error "Pedido no listo para despacho"
- Este es el comportamiento esperado para Coordinadora
- Dunamixfy indica que el pedido no puede despacharse (`can_ship = NO`)
- El código NO se guarda hasta que esté listo
- Contacta a Dunamixfy para resolver el estado del pedido

## 🔐 Seguridad

- Row Level Security (RLS) habilitado en todas las tablas
- Autenticación con Supabase Auth
- API keys en variables de entorno
- HTTPS obligatorio en producción

## 📊 Base de Datos

### Tablas principales
- `codes` - Códigos escaneados con cache mínimo
- `carriers` - Transportadoras dinámicas
- `operators` - Usuarios del sistema (deprecado, usar auth.users)

### Retención de datos
- Códigos: 7 días (auto-limpieza programada)
- Dunamixfy es fuente de verdad para datos completos

## ⚡ Optimizaciones de Performance

- **Cooldown dinámico**: 60% más rápido (800ms vs 2000ms)
- **ZXing TRY_HARDER**: +40% tasa de éxito en códigos impresos
- **Cache local**: Reduce consultas a BD
- **Code-splitting**: Lazy loading de rutas
- **PWA caching**: Assets en cache para offline

## 🤝 Contribuir

Este proyecto es privado para Dunamix.

## 📝 Licencia

Propietario - Dunamix © 2024-2025

---

## 🆘 Soporte

Para soporte técnico, contacta al desarrollador.

**Versión**: 6.0.0
**Última actualización**: Diciembre 2024
