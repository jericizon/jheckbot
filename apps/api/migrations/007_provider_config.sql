-- 007_provider_config.sql: provider selection and configuration

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS provider_config JSONB;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS default_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS default_provider_config JSONB;
