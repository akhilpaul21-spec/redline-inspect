-- Projects carry the per-project API key used in X-Redline-Key.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  page TEXT NOT NULL,
  selector TEXT NOT NULL,
  label TEXT NOT NULL,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_project_page ON comments(project, page);
CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);
