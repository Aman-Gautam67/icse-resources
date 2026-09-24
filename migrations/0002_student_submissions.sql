CREATE TABLE IF NOT EXISTS student_submissions (
  id TEXT PRIMARY KEY,
  receipt_hash TEXT NOT NULL UNIQUE,
  grade INTEGER NOT NULL CHECK (grade IN (10, 12)),
  subject TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  discord_id TEXT NOT NULL DEFAULT '',
  reddit_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  rejection_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS student_submissions_status_time ON student_submissions(status, submitted_at DESC);
CREATE TABLE IF NOT EXISTS student_submission_limits (
  client_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_hash, window_start)
);
