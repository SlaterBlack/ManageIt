# ManageIt

ManageIt is a shared-team project planner with a Gantt-style timeline. Its
Angular frontend uses the shared StoreIt Node/Express API and PostgreSQL
database. Team members sign in with their service-wide account; ManageIt project
and task data remains separate from ClockIt's time-tracking data.

## Requirements

- Node.js 20.19+ (Node.js 24 is supported)
- npm 10+
- A running StoreIt backend with its shared PostgreSQL database configured

## Local setup

ManageIt has no separate API or database. It uses StoreIt's shared account
(`POST /api/auth/login`, `GET /api/auth/me`) and the ManageIt API
(`/api/manageit/...`). Keep StoreIt running and use its local API address when
both apps are on the same machine.

1. Copy `frontend/.env.example` to `frontend/.env`. The defaults use
   `http://127.0.0.1:4002` for StoreIt and bind the production frontend server
   to `127.0.0.1:2402`. Change these only if your StoreIt address or deployment
   port differs. The production server can also read these values from its
   process environment.
2. Install and build the frontend:

   ```sh
   cd frontend
   npm install
   npm run build
   ```

3. Run locally in development with `npm start` (Angular on port 4201), or run
   the built app with `npm run serve` (production server on port 2402).

Both servers proxy `/api` requests to `STOREIT_API_URL`, so the browser uses the
same origin for ManageIt and StoreIt and no separate StoreIt CORS setting is
needed. On this host, open `https://manageit.ai3d.com.au:2400/`; Caddy proxies
that hostname to `127.0.0.1:2402`, keeping the frontend server bound to
loopback.

Projects have a unique three-digit code and a saved color. The Projects page supports preset and custom colors; development startup assigns codes to existing projects and gives them the default orange color.

StoreIt owns the shared user table and ManageIt data tables. Database creation
and any one-time legacy imports are managed from StoreIt; they are not required
to run this frontend.

## Project structure

```text
frontend/
  server.js                 Production static server and StoreIt API proxy
  proxy.conf.js             Angular development proxy
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

Tasks created from the Calendar form are top-level; use a task's **+** action to add a subtask, which starts with the parent's dates. New tasks use their project's color. In Timeline or List view, open a task's **…** button to rename it, set its assignee, change its state/progress or color, and edit its dates; use **Save changes** to apply the edits. Task and subtask colors are independent. In either view, turn on **Group change** to select visible tasks and subtasks, then apply one color or completion state to the selection. Group completion sets progress to 100% for Complete and 0% for Not started; In progress preserves the current progress percentage. Choose **+ Add milestone** to create a standalone single-date marker; milestones appear as diamonds and can participate in dependencies. Drag task bars to move them on the timeline and drag either end to resize their dates; moving a parent shifts its subtasks by the same number of days, while resizing a parent must still contain its subtasks. Milestones move as a point and cannot be resized. Drag the outer right dependency handle onto another task to make the dragged task its prerequisite; use the outer left handle to make the dropped task the prerequisite. Dependency cycles and links between different projects are rejected, and links can be removed from the dependency list below the timeline. Calendar's **Active** and **Archived** views let the team archive and restore individual tasks; archived parents hide their subtasks in active views. Permanently deleting a task also deletes its subtasks and dependencies.

Use **Import Gantt XML** in a project's Calendar to preview and append a GanttPRO or Microsoft Project XML export to that project. The importer carries task names, start/end dates, assignees, progress, milestones, one level of subtasks, and predecessor links. When the XML omits finish dates, it calculates them from task durations and the exported work calendar. The exported project-summary row is omitted because the import is added to the selected ManageIt project. ManageIt does not store Gantt descriptions, costs, or predecessor link types/lag; those are not imported. Importing appends tasks and does not update or deduplicate existing tasks. If task creation fails partway through, the importer attempts to remove the tasks it created.

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

This repository contains only the ManageIt frontend. StoreIt remains the
source of truth for authentication, API behavior, and PostgreSQL data. After
updating StoreIt with task-color support, run `npm run db:migrate` from
`StoreIt/backend` before restarting the shared API; this adds the task color
column and initializes existing tasks from their project's color.
