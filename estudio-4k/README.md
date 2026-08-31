# Estudio 4K Profesional — Todomotos S.A. de C.V.

Panel interno para el equipo de Todomotos que permite:

- **Controlar la iluminación del estudio fotográfico** (color RGB, temperatura e intensidad mediante sliders).
- **Generar contenido en 4K con Higgsfield.ai** (fotos/videos de producto listos para publicar).
- **Administrar varias cuentas de Facebook Ads desde un solo lugar** (una por tienda o marca de Todomotos) y publicar campañas con el contenido generado.

Este módulo vive dentro del repositorio principal, en la carpeta `estudio-4k/`, y ya está enlazado desde `centro-trabajo.html` (grupo de navegación **"Estudio 4K"**).

---

## 1. Arquitectura

```
estudio-4k/
├── frontend/     Dashboard web (Vite + React + TypeScript + Tailwind)
├── backend/      API (Node.js + Express + TypeScript + PostgreSQL)
├── database/     schema.sql — estructura de la base de datos
└── docker-compose.yml   Levanta PostgreSQL con un solo comando
```

- **Frontend** (puerto `5173`): la interfaz que usa el equipo — login, selector de cuenta de Facebook activa, control de iluminación, generación 4K y panel de campañas.
- **Backend** (puerto `3000`): API que atiende al frontend, guarda todo en PostgreSQL, cifra los tokens de Facebook (AES-256-GCM) y habla con Meta Graph API y con Higgsfield.ai.
- **Base de datos**: PostgreSQL. Guarda usuarios, cuentas de Facebook conectadas, historial de generaciones 4K, publicaciones de creativos y presets de iluminación guardados.

No es necesario tener conocimientos técnicos avanzados: los pasos de abajo son suficientes para dejar todo funcionando en una computadora.

---

## 2. Requisitos previos

- [Node.js](https://nodejs.org) versión 18 o superior.
- [Docker](https://www.docker.com/) (para levantar la base de datos fácilmente) — o un PostgreSQL propio si ya cuentas con uno.

---

## 3. Levantar la base de datos (PostgreSQL con Docker)

Desde la carpeta `estudio-4k/`:

```bash
cd estudio-4k
docker compose up -d
```

Esto crea un contenedor de PostgreSQL en el puerto `5432`, con la base de datos `estudio4k_db` ya inicializada con todas las tablas necesarias (lee automáticamente `database/schema.sql` la primera vez que arranca).

Para detenerlo: `docker compose down` (los datos quedan guardados; para borrarlos también, usa `docker compose down -v`).

---

## 4. Configurar el backend (API)

### 4.1 Crear el archivo de configuración

```bash
cd estudio-4k/backend
cp .env.example .env
```

### 4.2 Generar las claves secretas

El archivo `.env` necesita dos claves aleatorias y únicas que **no deben compartirse ni subirse a internet**:

- `JWT_SECRET`: firma las sesiones de los usuarios que entran al panel.
- `TOKEN_ENCRYPTION_KEY`: cifra los tokens de las cuentas de Facebook guardadas en la base de datos.

Genera cada una con este comando (ejecútalo dos veces, una para cada clave) y pega el resultado en el `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el valor generado en las líneas correspondientes de `backend/.env`:

```
JWT_SECRET=<pega aquí el primer valor generado>
TOKEN_ENCRYPTION_KEY=<pega aquí el segundo valor generado>
```

### 4.3 Completar las demás variables

En el mismo archivo `backend/.env`, revisa/ajusta:

- `DATABASE_URL`: si usaste el `docker-compose.yml` de este proyecto sin cambios, el valor por defecto ya funciona (`postgresql://postgres:password@localhost:5432/estudio4k_db`).
- `HIGGSFIELD_API_KEY` y `HIGGSFIELD_WORKSPACE_ID`: ver sección 6.
- `FB_APP_ID` y `FB_APP_SECRET`: opcionales como valores por defecto (cada cuenta de Facebook que se conecte desde el panel guarda su propio token, ver sección 6).

### 4.4 Instalar dependencias y arrancar

```bash
cd estudio-4k/backend
npm install
npm run dev
```

El backend queda disponible en **http://localhost:3000**.

---

## 5. Configurar y arrancar el frontend (dashboard)

En otra terminal:

```bash
cd estudio-4k/frontend
npm install
npm run dev
```

El dashboard queda disponible en **http://localhost:5173**. Ábrelo en el navegador para iniciar sesión y usar el panel.

---

## 6. Obtener las claves de los servicios externos

### 6.1 Higgsfield.ai (generación de contenido 4K)

1. Entra a tu cuenta de [Higgsfield.ai](https://higgsfield.ai) (o crea una si aún no la tienes).
2. En la sección de configuración/API de tu cuenta, genera una **API key**.
3. Copia esa clave en `HIGGSFIELD_API_KEY` dentro de `backend/.env`.
4. Copia el ID de tu espacio de trabajo en `HIGGSFIELD_WORKSPACE_ID`.

### 6.2 Facebook Ads (Meta) — conectar cuentas publicitarias

El panel está diseñado para administrar **varias cuentas de Facebook Ads a la vez** (por ejemplo, una por sucursal o marca de Todomotos). No hace falta configurar nada de Facebook en el `.env`: la conexión se hace **desde el panel**, cuenta por cuenta:

1. En el Administrador de negocios de Meta (business.facebook.com), genera un **token de acceso de un "Usuario del sistema" (System User)** con el permiso **`ads_management`** (y acceso asignado a las cuentas publicitarias que quieras administrar). Este tipo de token es de larga duración y es el recomendado para este panel — a diferencia de un token personal, no expira al cerrar sesión.
2. En el dashboard, entra a **"Cuentas conectadas"** y elige **"Conectar cuenta"**.
3. Pega el token generado. El panel valida el token automáticamente y **descubre las cuentas publicitarias disponibles** para ese token.
4. Elige la cuenta (o cuentas) que quieres conectar y ponles un nombre visible (por ejemplo, "Todomotos Medina" o "Todomotos San Pedro").
5. El token queda guardado **cifrado** en la base de datos (nunca en texto plano) y a partir de ahí puedes cambiar entre cuentas desde el selector del sidebar sin repetir este proceso.

Puedes repetir este flujo tantas veces como cuentas de Facebook Ads necesites administrar.

---

## 7. Cómo queda enlazado con el resto del sitio

El sitio principal de Todomotos (`index.html`, `catalogo.html`) no cambió. Solo se agregó un enlace nuevo en **`centro-trabajo.html`**, dentro del grupo de navegación **"Estudio 4K"**, que apunta a `estudio-4k/frontend/index.html` (la página del dashboard una vez compilado/servido). Mientras el frontend corre con `npm run dev`, ese enlace debe apuntar a `http://localhost:5173` en desarrollo; en producción, se debe compilar el frontend (`npm run build` dentro de `estudio-4k/frontend`) y publicar el resultado de `estudio-4k/frontend/dist/` en la ruta correspondiente del sitio.

---

## 8. Resumen rápido de comandos

```bash
# 1. Base de datos
cd estudio-4k && docker compose up -d

# 2. Backend
cd estudio-4k/backend
cp .env.example .env
# (generar y pegar JWT_SECRET y TOKEN_ENCRYPTION_KEY, ver sección 4.2)
npm install
npm run dev        # http://localhost:3000

# 3. Frontend (en otra terminal)
cd estudio-4k/frontend
npm install
npm run dev         # http://localhost:5173
```
