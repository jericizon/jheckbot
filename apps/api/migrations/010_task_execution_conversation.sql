-- 010_task_execution_conversation.sql: durable link between an office task and its project conversation

DO $$
DECLARE
  conflict_office_ids text;
BEGIN
  SELECT string_agg(office_id::text, ', ')
    INTO conflict_office_ids
    FROM (
      SELECT office_id
      FROM tasks
      WHERE created_by = 'ceo'
        AND workflow_type = 'simple'
        AND status IN ('backlog', 'planning', 'ready', 'assigned', 'working')
      GROUP BY office_id
      HAVING COUNT(*) > 1
    ) t;

  IF conflict_office_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Existing active CEO simple tasks violate the one-active-execution constraint for office_ids: %', conflict_office_ids;
  END IF;
END $$;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS execution_conversation_id UUID
    REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_execution_conversation_id
  ON tasks (execution_conversation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_one_active_ceo_execution
  ON tasks (office_id)
  WHERE created_by = 'ceo'
    AND workflow_type = 'simple'
    AND status IN ('backlog', 'planning', 'ready', 'assigned', 'working');
