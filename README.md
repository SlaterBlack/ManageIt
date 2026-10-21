# ManageIt

ManageIt is a shared-team project planner with a Gantt-style timeline. It uses an Angular CLI frontend, a TypeScript/Express backend, Sequelize models, and PostgreSQL. Every team member sees the same projects; there are no accounts, workspace switching, project ownership, roles, or subscription tiers.

## Requirements

- Node.js 20.19+ (Node.js 24 is supported)
- npm 10+
- PostgreSQL 16+ (the backend connects to a local or remote PostgreSQL server)

## Local setup

1. Create a dedicated PostgreSQL database named `manageit`. Keep it separate from any other application's database.
2. Copy `backend/.env.example` to `backend/.env` and set the PostgreSQL host, port, username, and password. The ManageIt database name must remain `manageit`.
3. In one terminal, install and start the backend:

   ```powershell
   Set-Location backend
   npm install
   npm run dev
   ```

4. In a second terminal, install and start Angular:

   ```powershell
   Set-Location frontend
   npm install
   npm start
   ```

Open `http://localhost:4201`. The API listens on `http://localhost:4001`; the Angular development server proxies `/api` requests to it. On first development startup, Sequelize synchronizes the model schema and adds a small demo project if the ManageIt database is empty.

The local `backend/.env` contains machine-specific database credentials and must not be committed. The development server uses the same PostgreSQL server as ClockedIn with `DB_NAME=manageit`, so ManageIt's tables and data stay isolated.

## Project structure

```text
frontend/
  src/app/core/models/       Shared project and task types
  src/app/core/services/     HTTP API services
  src/app/features/projects/ Project planning page
  src/app/layout/            App shell and navigation
  src/styles/                Orange-and-cream SCSS tokens and shared styles
backend/
  src/config/                Environment and Sequelize configuration
  src/controllers/           Project and task request handlers
  src/middleware/            API errors and not-found handling
  src/models/                Sequelize project and task models
  src/routes/                REST API routes
  src/server.ts              Database startup and development schema sync
```

Generate frontend components and services through Angular CLI:

```powershell
Set-Location frontend
npm run ng -- generate component features/example --standalone --style=scss
npm run ng -- generate service core/services/example
```

## API

- `GET /api/health` — API/database readiness
- `GET /api/projects` / `POST /api/projects`
- `PATCH /api/projects/:id` / `DELETE /api/projects/:id`
- `GET /api/projects/:projectId/tasks` / `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId` / `DELETE /api/tasks/:taskId`

Task creation requires a name and valid `startDate` / `dueDate` values (`YYYY-MM-DD`), with the due date on or after the start date. Validation failures return a JSON `error` message.

## Build

Run the build in each app directory:

```powershell
Set-Location backend
npm run build

Set-Location ..\frontend
npm run build
```

The backend uses `sequelize.sync({ alter: true })` only in development for this scaffold. Use explicit database migrations before production deployment.
