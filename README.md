# Super Cerebro

Portal personal full-stack con autenticación Google OAuth + Passkeys (WebAuthn).

**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · Node.js · Express 5 · Prisma 7 · PostgreSQL (Railway)

---

## Estructura del proyecto

```
super-cerebro/
├── frontend/   # React + Vite + TypeScript + Tailwind CSS v4
└── backend/    # Node.js + Express + TypeScript + Prisma + PostgreSQL
```

---

## Flujo de autenticación

```
1. Login con Google OAuth
        ↓
2. Callback → JWT guardado en localStorage
        ↓
3. Registro automático de passkey (Touch ID / Face ID)
        ↓
4. Próximos ingresos → biometría directa (sin Google)
```

- **Primera vez:** botón "Continuar con Google" → Google OAuth → callback registra passkey automáticamente
- **Regresos:** huella / Face ID directamente
- **"Usar otra cuenta":** limpia todo el estado y vuelve al estado inicial

---

## Inicio rápido

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run dev:tunnel   # apunta al backend via Dev Tunnel
npm run build
npm test
```

### Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:3000
npm run dev:tunnel   # usa TUNNEL_URL + FRONTEND_URL de Dev Tunnel
npm test
npm start            # producción
```

---

## Variables de entorno

### Backend — `backend/.env`

Copiar `backend/.env.example` a `backend/.env`:

| Variable | Descripción | Requerida |
|---|---|---|
| `PORT` | Puerto del servidor (default: 3000) | No |
| `NODE_ENV` | `development` / `production` | Sí |
| `DATABASE_URL` | Connection string PostgreSQL | Sí |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID de Google | Sí |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret de Google | Sí |
| `JWT_SECRET` | Clave para firmar JWTs (mínimo 32 chars) | Sí |
| `BACKEND_URL` | URL pública del backend | Sí |
| `FRONTEND_URL` | URL del frontend (para redirect post-OAuth y rpID de WebAuthn) | Sí |
| `TUNNEL_URL` | URL del backend via Dev Tunnel (override de callbackURL OAuth en dev) | No |

### Frontend — `frontend/.env`

Copiar `frontend/.env.example` a `frontend/.env`:

| Variable | Descripción | Requerida |
|---|---|---|
| `VITE_BACKEND_URL` | URL base del backend | Sí |
| `VITE_TUNNEL_URL` | URL del backend via Dev Tunnel (tiene prioridad sobre `VITE_BACKEND_URL`) | No |

---

## Dev Tunnels (pruebas desde iPhone / dispositivos externos)

Para probar WebAuthn (Touch ID / Face ID) desde un dispositivo real:

1. Abrir dos Dev Tunnels en VS Code:
   - Puerto **3000** → backend tunnel (p. ej. `https://xxx-3000.use2.devtunnels.ms`)
   - Puerto **5173** → frontend tunnel (p. ej. `https://xxx-5173.use2.devtunnels.ms`)

2. Registrar la URL del backend en Google Cloud Console como **Authorized redirect URI**:
   ```
   https://xxx-3000.use2.devtunnels.ms/auth/google/callback
   ```

3. Actualizar las URLs en los `.env`:
   ```ini
   # backend/.env
   TUNNEL_URL=https://xxx-3000.use2.devtunnels.ms

   # frontend/.env
   VITE_TUNNEL_URL=https://xxx-3000.use2.devtunnels.ms
   ```
   *(o usar los scripts `dev:tunnel` que las inyectan directamente)*

4. Levantar con:
   ```bash
   # Terminal 1 — backend
   cd backend && npm run dev:tunnel

   # Terminal 2 — frontend
   cd frontend && npm run dev:tunnel
   ```

5. Abrir `https://xxx-5173.use2.devtunnels.ms` desde el iPhone.

> **Nota:** `TUNNEL_URL` en el backend configura el `callbackURL` de Google OAuth.
> `FRONTEND_URL` en el backend configura el `rpID` y `origin` de WebAuthn — ambos se derivan automáticamente de esta variable.

---

## Endpoints

### Salud

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | No | Verifica que el servidor responde |

### Google OAuth

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/auth/google` | No | Inicia flujo OAuth con Google |
| GET | `/auth/google/callback` | No | Callback de Google → emite JWT |

### Passkeys (WebAuthn)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/passkey/register/start` | JWT | Genera opciones de registro |
| POST | `/auth/passkey/register/finish` | JWT | Verifica y guarda el passkey |
| POST | `/auth/passkey/login/start` | No | Genera opciones de autenticación |
| POST | `/auth/passkey/login/finish` | No | Verifica passkey y emite JWT |

---

## Base de datos

Prisma 7 con driver adapter `@prisma/adapter-pg`. Schema en `backend/prisma/schema.prisma`.

Tablas:
- **User** — `id`, `googleId`, `email`, `name`, `createdAt`
- **Passkey** — `id`, `userId`, `credentialId`, `publicKey`, `counter`, `createdAt`

```bash
npx prisma generate      # genera el cliente
npx prisma migrate dev   # aplica migraciones en desarrollo
npx prisma studio        # explorador visual
```

La base de datos corre en Railway. Para desarrollo local usar la URL pública (`*.proxy.rlwy.net`). En producción usar la URL interna (`postgres.railway.internal`).

---

## Tests

```bash
# Todos los tests
cd backend && npm test
cd frontend && npm test

# Por tipo (backend)
npm run test:unit
npm run test:integration
npm run test:e2e
```

El backend tiene **79+ tests** (unit + integration + E2E):
- `unit/` — Middleware JWT, CORS, configuración de passport/túnel, validación de inputs
- `integration/` — Flujos completos Express con Prisma y SimpleWebAuthn mockeados
- `e2e/` — Round-trip real con PostgreSQL (SimpleWebAuthn mockeado)

El frontend tiene **48+ tests** (unit + integration):
- `unit/` — LoginPage, CallbackPage (incluyendo flujos WebAuthn), ProtectedRoute
- `integration/` — Flujo completo de autenticación en el árbol de rutas
