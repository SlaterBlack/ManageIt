BEGIN;

ALTER TABLE public.projects
  ADD COLUMN project_code VARCHAR(3),
  ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#D87535';

DO $migration$
DECLARE
  project_row RECORD;
  next_code INTEGER := 0;
  project_code_value TEXT;
BEGIN
  FOR project_row IN
    SELECT id
    FROM public.projects
    WHERE project_code IS NULL
    ORDER BY id
  LOOP
    LOOP
      IF next_code > 999 THEN
        RAISE EXCEPTION 'Cannot assign unique three-digit project codes to all projects';
      END IF;

      project_code_value := LPAD(next_code::TEXT, 3, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.projects
        WHERE project_code = project_code_value
      );
      next_code := next_code + 1;
    END LOOP;

    UPDATE public.projects
    SET project_code = project_code_value
    WHERE id = project_row.id;
    next_code := next_code + 1;
  END LOOP;
END;
$migration$;

ALTER TABLE public.projects
  ALTER COLUMN project_code SET NOT NULL;

CREATE UNIQUE INDEX projects_project_code_unique
  ON public.projects (project_code);

COMMIT;
