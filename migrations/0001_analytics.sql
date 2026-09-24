CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('visit', 'download')),
  page_path TEXT NOT NULL DEFAULT '',
  file_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_events_time ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_time ON analytics_events(visitor_id, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_file ON analytics_events(file_id, event_type);
