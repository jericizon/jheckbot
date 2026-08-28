-- 009_office_domain.sql: core Office domain tables

CREATE TABLE IF NOT EXISTS offices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  config      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offices_project_id ON offices (project_id);
CREATE INDEX IF NOT EXISTS idx_offices_user_id ON offices (user_id);

CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id       UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT,
  description     TEXT,
  avatar          TEXT,
  personality     TEXT,
  instructions    TEXT,
  responsibilities TEXT,
  provider        TEXT,
  model           TEXT,
  skills          JSONB,
  tools           JSONB,
  permissions     JSONB,
  project_access  JSONB,
  status          TEXT NOT NULL DEFAULT 'idle',
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_office_id ON agents (office_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents (enabled);

CREATE TABLE IF NOT EXISTS agent_capabilities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  capability  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_agent_capabilities_agent_id ON agent_capabilities (agent_id);

CREATE TABLE IF NOT EXISTS agent_memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID REFERENCES agents(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  scope       TEXT NOT NULL CHECK (scope IN ('global', 'project', 'agent', 'task')),
  memory_type TEXT,
  content     TEXT NOT NULL,
  importance  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_project_id ON agent_memories (project_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_scope ON agent_memories (scope);

CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id           UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  parent_task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  acceptance_criteria TEXT,
  status              TEXT NOT NULL DEFAULT 'backlog',
  priority            TEXT NOT NULL DEFAULT 'medium',
  assigned_agent_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_by          TEXT,
  workflow_type       TEXT,
  metadata            JSONB,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_office_id ON tasks (office_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent_id ON tasks (assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id               UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  to_agent_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  content       TEXT NOT NULL,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_office_id ON agent_messages (office_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_task_id ON agent_messages (task_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_from_agent_id ON agent_messages (from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to_agent_id ON agent_messages (to_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON agent_messages (created_at);

CREATE TABLE IF NOT EXISTS office_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  content       TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_events_office_id ON office_events (office_id);
CREATE INDEX IF NOT EXISTS idx_office_events_created_at ON office_events (created_at);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id     UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  root_task_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_office_id ON workflow_runs (office_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_root_task_id ON workflow_runs (root_task_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs (status);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id   UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  task_id           UUID REFERENCES tasks(id) ON DELETE SET NULL,
  step_type         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  sequence          INTEGER NOT NULL,
  metadata          JSONB,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_run_id ON workflow_steps (workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_task_id ON workflow_steps (task_id);
