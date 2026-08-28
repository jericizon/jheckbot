-- 008_conversation_pin.sql: add pin support to conversations

ALTER TABLE conversations
  ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_conversations_is_pinned ON conversations (is_pinned);
