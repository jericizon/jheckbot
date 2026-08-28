-- 004_transactional_chat.sql: align message types and add ordered agent event cursors

UPDATE messages
SET message_type = CASE role
  WHEN 'user' THEN 'prompt'
  WHEN 'assistant' THEN 'output'
  WHEN 'system' THEN 'status'
END
WHERE message_type = 'text';

ALTER TABLE messages
  ALTER COLUMN message_type SET DEFAULT 'prompt',
  ADD CONSTRAINT messages_message_type_check
    CHECK (message_type IN ('prompt', 'output', 'error', 'status'));

ALTER TABLE agent_events
  ADD COLUMN event_sequence BIGSERIAL NOT NULL;

CREATE UNIQUE INDEX idx_agent_events_event_sequence
  ON agent_events (event_sequence);
