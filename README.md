# ManageIt

ManageIt is a shared-team project planner with a Gantt-style timeline. Its
Angular frontend uses the shared StoreIt Node/Express API and PostgreSQL
database. Team members sign in with their service-wide account; ManageIt project
and task data remains separate from ClockIt's time-tracking data.

## Requirements

- Node.js 20.19+ (Node.js 24 is supported)
- npm 10+
- PostgreSQL 16+ (the backend connects to a local or remote PostgreSQL server)
- PostgreSQL access to the ClockedIn database's `users` table

## Local setup

1. Configure `StoreIt/backend/.env` with the StoreIt PostgreSQL database and shared `JWT_SECRET`.
2. Ensure the existing ClockIt and ManageIt PostgreSQL databases are reachable with the source credentials in the StoreIt environment file.
3. From `StoreIt/backend`, install dependencies, create the StoreIt schema, and run the read-only migration preflight:

   ```powershell
   Set-Location ..\StoreIt\backend
   npm install
   npm run db:migrate
   npm run data:check
   ```

4. After reviewing the preflight counts and backing up both source databases, import the legacy data with `npm run data:migrate`.
5. Start StoreIt:

   ```powershell
   npm run dev
   ```

6. In a second terminal, install and start Angular:

   ```powershell
   Set-Location frontend
   Copy-Item .env.example .env
   npm install
   npm start
   ```

Open the ManageIt frontend and sign in with your service account. It sends
ManageIt project/task requests to `/api/manageit/...`; shared sign-in uses
`/api/auth`. The frontend proxy reads `STOREIT_API_URL` from
`frontend/.env` (copy `.env.example` there), defaulting to
`http://127.0.0.1:4002`.

Projects have a unique three-digit code and a saved color. The Projects page supports preset and custom colors; development startup assigns codes to existing projects and gives them the default orange color.

StoreIt contains the shared user table and both app data sets. The migration
preserves ClockIt's user UUIDs and password hashes, and imports ClockIt and
ManageIt data into separate tables. The legacy ClockIt and ManageIt backend
folders were removed after the imported data was verified.

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
```

The app shell provides separate `/overview`, `/projects`, and `/calendar` pages. Opening a project from the project list navigates to its calendar using the `project` query parameter. The Projects page separates active and archived projects; archived projects can be restored or permanently deleted from their **…** menu. Archiving a project hides it and its tasks from active views without changing task archive flags. Permanently deleting a project also deletes its tasks and dependencies.

Tasks created from the Calendar form are top-level; use a task's **+** action to add a subtask, which starts with the parent's dates and can be edited from its **…** menu. Choose **+ Add milestone** to create a standalone single-date marker; milestones appear as diamonds and can participate in dependencies. Use **… → Edit task** to update task details. Drag task bars to move them on the timeline and drag either end to resize their dates; milestones move as a point and cannot be resized. Parent/subtask date limits are enforced. Drag the outer right dependency handle onto another task to make the dragged task its prerequisite; use the outer left handle to make the dropped task the prerequisite. Dependency cycles and links between different projects are rejected, and links can be removed from the dependency list below the timeline. Calendar's **Active** and **Archived** views let the team archive and restore individual tasks; archived parents hide their subtasks in active views. Permanently deleting a task also deletes its subtasks and dependencies.

Generate frontend components and services through Angular CLI:

```powershell
Set-Location frontend
npm run ng -- generate component features/example --standalone --style=scss
npm run ng -- generate service core/services/example
```

## API

- `GET /api/health` — StoreIt API/database readiness
- `POST /api/auth/login` / `GET /api/auth/me` — shared service sign-in and current user
- `GET /api/manageit/projects` / `POST /api/manageit/projects`
- `PATCH /api/manageit/projects/:id` / `DELETE /api/manageit/projects/:id`
- `GET /api/manageit/projects/:projectId/tasks` / `POST /api/manageit/projects/:projectId/tasks`
- `GET /api/manageit/projects/:projectId/dependencies` / `POST /api/manageit/projects/:projectId/dependencies`
- `DELETE /api/manageit/projects/:projectId/dependencies/:dependencyId`
- `PATCH /api/manageit/tasks/:taskId` / `DELETE /api/manageit/tasks/:taskId`

Project creation requires a unique three-digit `projectCode` and a `name`; `color` is an optional six-digit hex value that defaults to orange. Project updates accept `projectCode`, `name`, `description`, `color`, and the boolean `isArchived`.

Task creation requires a name and valid `startDate` / `dueDate` values (`YYYY-MM-DD`), with the due date on or after the start date. Set `isMilestone: true` to create a standalone milestone with the same start and due date; milestones cannot be subtasks. An optional `parentTaskId` creates a subtask whose date range must be inside its parent's; nesting beyond one subtask level is not supported. Task updates accept a boolean `isArchived`. Dependency creation accepts `predecessorTaskId` and `successorTaskId` for tasks and milestones in the project; cycles, duplicate links, and self-links are rejected. Validation failures return a JSON `error` message.

## Build

Build the shared API from `StoreIt/backend` and the frontend from `ManageIt/frontend`:

```powershell
Set-Location ..\StoreIt\backend
npm run build

Set-Location ..\ManageIt\frontend
npm run build
```

StoreIt's schema command creates missing tables only; it does not alter or drop
legacy databases. The legacy migration defaults to a read-only check. Review
and back up source databases before invoking the explicit import command.
