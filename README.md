# ManageIt

ManageIt is a shared-team project planner with a Gantt-style timeline. It uses an Angular CLI frontend, a TypeScript/Express backend, Sequelize models, and PostgreSQL. Team members sign in with their existing ClockedIn account; all authenticated team members share the same projects, with no workspace switching, project ownership, roles, billing, or subscription tiers.

## Requirements

- Node.js 20.19+ (Node.js 24 is supported)
- npm 10+
- PostgreSQL 16+ (the backend connects to a local or remote PostgreSQL server)
- PostgreSQL access to the ClockedIn database's `users` table

## Local setup

1. Create a dedicated PostgreSQL database named `manageit`. Keep it separate from any other application's database.
2. Copy `backend/.env.example` to `backend/.env` and configure both database connections. Keep `DB_NAME=manageit`; set `CLOCKEDIN_DB_NAME` to the ClockedIn database name and provide a database user with read access to its `users` table. Set `MANAGEIT_JWT_SECRET` to a long random value.
3. Ensure PostgreSQL is running and both databases are reachable. The ClockedIn web/API service does not need to be running.
4. In one terminal, install and start the backend:

   ```powershell
   Set-Location backend
   npm install
   npm run dev
   ```

5. In a second terminal, install and start Angular:

   ```powershell
   Set-Location frontend
   npm install
   npm start
   ```

Open `http://localhost:4201` and sign in with a ClockedIn account. The API listens on `http://localhost:4001`; the Angular development server proxies `/api` requests to it. On first development startup, Sequelize synchronizes the ManageIt model schema and adds a small demo project if the ManageIt database is empty.

Projects have a unique three-digit code and a saved color. The Projects page supports preset and custom colors; development startup assigns codes to existing projects and gives them the default orange color.

The local `backend/.env` contains machine-specific database credentials and must not be committed. ManageIt uses a separate `manageit` database for projects and tasks, and reads only the ClockedIn `users` table to verify bcrypt password hashes and retrieve the current user profile. It never stores or returns ClockedIn password hashes. ManageIt issues its own signed tokens, so the ClockedIn web/API service can be stopped; PostgreSQL and the ClockedIn database must remain available. For production, use a ClockedIn database role that has `CONNECT` access and `SELECT` permission on `public.users` only.

For production, create a dedicated read-only PostgreSQL role for ClockedIn account lookups. Replace the example password and database name:

```sql
CREATE ROLE manageit_accounts_reader LOGIN PASSWORD 'replace-with-a-strong-password';
GRANT CONNECT ON DATABASE clockify_dupe TO manageit_accounts_reader;
```

Connect to the ClockedIn database, then grant access only to its user table:

```sql
GRANT USAGE ON SCHEMA public TO manageit_accounts_reader;
GRANT SELECT ON TABLE public.users TO manageit_accounts_reader;
```

Set `CLOCKEDIN_DB_USER` and `CLOCKEDIN_DB_PASSWORD` to this role in `backend/.env`.

## Project structure

```text
frontend/
  src/app/core/models/       Shared project and task types
  src/app/core/services/     HTTP API services
  src/app/features/auth/     ClockedIn account sign-in
  src/app/features/calendar/ Project task timeline and list
  src/app/features/overview/ Team and project summary
  src/app/features/projects/ Shared projects, codes, and color picker
  src/app/layout/            App shell and navigation
  src/styles/                Orange-and-cream SCSS tokens and shared styles
backend/
  src/config/                Environment and Sequelize configuration
  src/controllers/           Project and task request handlers
  migrations/                Production PostgreSQL migrations
  src/middleware/            API errors and not-found handling
  src/models/                Sequelize project and task models
  src/routes/                REST API routes
  src/server.ts              Database startup and development schema sync
```

The app shell provides separate `/overview`, `/projects`, and `/calendar` pages. Opening a project from the project list navigates to its calendar using the `project` query parameter.

Tasks created from the Calendar form are top-level; use a task's **+** action to add a subtask, which starts with the parent's dates and can be edited from its **…** menu. Choose **+ Add milestone** to create a standalone single-date marker; milestones appear as diamonds and can participate in dependencies. Use **… → Edit task** to update task details. Drag task bars to move them on the timeline and drag either end to resize their dates; milestones move as a point and cannot be resized. Parent/subtask date limits are enforced. Drag the outer right dependency handle onto another task to make the dragged task its prerequisite; use the outer left handle to make the dropped task the prerequisite. Dependency cycles and links between different projects are rejected, and links can be removed from the dependency list below the timeline.

Generate frontend components and services through Angular CLI:

```powershell
Set-Location frontend
npm run ng -- generate component features/example --standalone --style=scss
npm run ng -- generate service core/services/example
```

## API

- `GET /api/health` — API/database readiness
- `POST /api/auth/login` / `GET /api/auth/me` — database-backed ClockedIn sign-in and current user (login is public; `/me` requires a valid ManageIt bearer token)
- `GET /api/projects` / `POST /api/projects` — requires a valid ClockedIn bearer token
- `PATCH /api/projects/:id` / `DELETE /api/projects/:id`
- `GET /api/projects/:projectId/tasks` / `POST /api/projects/:projectId/tasks`
- `GET /api/projects/:projectId/dependencies` / `POST /api/projects/:projectId/dependencies`
- `DELETE /api/projects/:projectId/dependencies/:dependencyId`
- `PATCH /api/tasks/:taskId` / `DELETE /api/tasks/:taskId`

Project creation requires a unique three-digit `projectCode` and a `name`; `color` is an optional six-digit hex value that defaults to orange. Project updates accept `projectCode`, `name`, `description`, and `color`.

Task creation requires a name and valid `startDate` / `dueDate` values (`YYYY-MM-DD`), with the due date on or after the start date. Set `isMilestone: true` to create a standalone milestone with the same start and due date; milestones cannot be subtasks. An optional `parentTaskId` creates a subtask whose date range must be inside its parent's; nesting beyond one subtask level is not supported. Dependency creation accepts `predecessorTaskId` and `successorTaskId` for tasks and milestones in the project; cycles, duplicate links, and self-links are rejected. Validation failures return a JSON `error` message.

## Build

Run the build in each app directory:

```powershell
Set-Location backend
npm run build

Set-Location ..\frontend
npm run build
```

The backend uses `sequelize.sync({ alter: true })` only in development for this scaffold. Use explicit database migrations before production deployment.

For an existing production ManageIt database, run [`backend/migrations/20261021_add_project_code_and_color.sql`](./backend/migrations/20261021_add_project_code_and_color.sql) once before deploying the project-code/color backend. It assigns unused three-digit codes and applies the default orange to existing projects. Do not run this one-time migration against a database that already has these columns.

For the task dependency and subtask schema, run [`backend/migrations/20261021_add_task_dependencies_and_subtasks.sql`](./backend/migrations/20261021_add_task_dependencies_and_subtasks.sql) against an existing production ManageIt database before deploying the feature. The script expects PostgreSQL's `gen_random_uuid()` function to be available.

For milestone support, run [`backend/migrations/20261021_add_task_milestones.sql`](./backend/migrations/20261021_add_task_milestones.sql) against an existing production ManageIt database before deploying the feature.
