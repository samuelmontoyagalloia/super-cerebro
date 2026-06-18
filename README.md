# Super Cerebro

Aplicación full-stack con frontend en React y backend en Node.js conectado a PostgreSQL.

## Estructura del proyecto

```
super-cerebro/
├── frontend/   # React + Vite + Tailwind CSS
└── backend/    # Node.js + Express + Prisma
```

## Frontend

**Stack:** Vite 8 · React · Tailwind CSS v4

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
```

Variables de entorno — copiar `.env.example` a `.env`:

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend |

## Backend

**Stack:** Node.js · Express 5 · Prisma 7 · PostgreSQL (Railway)

```bash
cd backend
npm install
npm run dev      # http://localhost:3000
npm start        # producción
```

Variables de entorno — copiar `.env.example` a `.env`:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default: 3000) |
| `NODE_ENV` | Entorno (`development` / `production`) |
| `DATABASE_URL` | Connection string de PostgreSQL |

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Verifica que el servidor responde |

### Base de datos

Prisma 7 con driver adapter `@prisma/adapter-pg`. El schema está en `backend/prisma/schema.prisma`.

```bash
npx prisma generate      # genera el cliente
npx prisma migrate dev   # aplica migraciones
npx prisma studio        # explorador visual
```

## Conexión a base de datos

La base de datos corre en Railway. Para desarrollo local usar la URL pública (`*.proxy.rlwy.net`). En producción usar la URL interna (`postgres.railway.internal`).
