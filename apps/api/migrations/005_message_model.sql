-- 005_message_model.sql: track which model generated each assistant message

ALTER TABLE messages
  ADD COLUMN model TEXT;
