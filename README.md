# 🚀 Dunamix Scanner

Scanner QR/Barcode para control de entregas con React + Vite + Supabase

## ✨ Características

- 📱 Scanner QR y códigos de barras
- 🔄 Sincronización en tiempo real entre dispositivos
- ✅ Detección automática de duplicados
- 📊 Dashboard con estadísticas
- 🏢 Soporte para múltiples transportadoras (Coordinadora, Interrápidisimo)
- 💾 Base de datos PostgreSQL con Supabase
- 📴 Funciona offline (PWA)
- 📈 Exportar datos a CSV

## 🛠️ Tecnologías

- **React 18** - Framework UI
- **Vite** - Build tool ultra rápido
- **Supabase** - Backend as a Service (PostgreSQL + Auth + Realtime)
- **Zustand** - State management
- **Tailwind CSS** - Estilos
- **html5-qrcode** - Scanner de QR/Barcode
- **React Hot Toast** - Notificaciones

## 📋 Requisitos Previos

- Node.js 18+ instalado
- Cuenta en Supabase (gratis)
- Editor de código (VS Code recomendado)

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
   - Name: `dunamix-scanner`
   - Database Password: `[inventa uno seguro]`
   - Region: `South America (São Paulo)`
5. Click "Create new project" (tarda ~2 min)

#### 3.2 Crear las tablas

Ve a **SQL Editor** en Supabase y ejecuta este script:

```sql
-- Tabla de operarios
CREATE TABLE operators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(name)
);

-- Tabla de códigos escaneados
CREATE TABLE codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  carrier TEXT NOT NULL CHECK (carrier IN ('coordinadora', 'interrapidisimo')),
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(code)
);

-- Índices para mejorar performance
CREATE INDEX idx_codes_created_at ON codes(created_at DESC);
CREATE INDEX idx_codes_carrier ON codes(carrier);
CREATE INDEX idx_codes_operator ON codes(operator_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

-- Policies para acceso público (anon)
CREATE POLICY "Enable read access for all users" ON operators
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON operators
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON codes
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON codes
  FOR INSERT WITH CHECK (true);
```

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

## 🚀 Deploy

### Vercel (Recomendado - Gratis)

1. Instala Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Configura las variables de entorno en Vercel Dashboard

### Netlify

1. Conecta tu repositorio de GitHub
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Agrega las variables de entorno

## 🗂️ Estructura del Proyecto

```
dunamix-scanner/
├── src/
│   ├── components/       # Componentes de UI
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Scanner.jsx
│   │   └── Stats.jsx
│   ├── services/         # Servicios (Supabase)
│   │   └── supabase.js
│   ├── hooks/            # Custom hooks
│   │   ├── useScanner.js
│   │   └── useRealtime.js
│   ├── store/            # Estado global (Zustand)
│   │   └── useStore.js
│   ├── utils/            # Utilidades
│   │   └── validators.js
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── public/
│   └── dunfy_fondo_coscuro.png
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env
```

## 🔧 Configuración de Transportadoras

### Coordinadora
- **Formato**: Termina en "001" y tiene más de 20 caracteres
- **Ejemplo**: `70020222800020000356813890077001`
- **Código extraído**: `56813890077` (11 dígitos antes de "001")

### Interrápidisimo
- **Formato**: 12 o 13 dígitos que empiezan con "24"
- **Ejemplo**: `240041585918` o `2400415859180`
- **Código extraído**: `240041585918` (primeros 12 dígitos)

## 📱 PWA (Progressive Web App)

La app se puede instalar en el teléfono:

1. Abre la URL en Chrome/Safari
2. Click en "Agregar a pantalla de inicio"
3. Funciona como app nativa
4. Trabaja offline

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

## 📊 Migrar datos desde Google Sheets

Si tienes datos en Google Sheets:

1. Exporta a CSV
2. Ve a **Table Editor** en Supabase
3. Click en `codes` table
4. Click **Insert** → **Insert rows from CSV**
5. Mapea las columnas correctamente

## 🤝 Contribuir

Este proyecto es privado para Dunamix.

## 📝 Licencia

Propietario - Dunamix © 2024

---

## 🆘 Soporte

Para soporte técnico, contacta al desarrollador.

**Versión**: 1.0.0
**Última actualización**: Diciembre 2024
