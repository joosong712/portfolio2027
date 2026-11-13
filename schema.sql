CREATE TABLE IF NOT EXISTS projects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 slug TEXT UNIQUE NOT NULL,
 title TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('custom','template')),
 industry TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL DEFAULT '',
 year INTEGER,
 tech_json TEXT NOT NULL DEFAULT '[]',
 summary TEXT NOT NULL DEFAULT '',
 site_url TEXT,
 image_key TEXT,
 detail_image_key TEXT,
 published INTEGER NOT NULL DEFAULT 0,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(published,category,sort_order);
