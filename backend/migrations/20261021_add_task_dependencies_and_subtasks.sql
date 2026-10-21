BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN parent_task_id UUID
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;

CREATE INDEX tasks_parent_task_id_idx
  ON public.tasks (parent_task_id);

CREATE TABLE public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  predecessor_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  successor_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_dependencies_no_self_link
    CHECK (predecessor_task_id <> successor_task_id),
  CONSTRAINT task_dependencies_project_pair_unique
    UNIQUE (project_id, predecessor_task_id, successor_task_id)
);

CREATE INDEX task_dependencies_predecessor_task_id_idx
  ON public.task_dependencies (predecessor_task_id);

CREATE INDEX task_dependencies_successor_task_id_idx
  ON public.task_dependencies (successor_task_id);

COMMIT;
