CREATE TABLE IF NOT EXISTS aurapops (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_token_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  background_mode TEXT NOT NULL DEFAULT 'color' CHECK (background_mode IN ('color','image')),
  background_color TEXT NOT NULL DEFAULT '#0b1610',
  card_color TEXT NOT NULL DEFAULT '#111a16',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  accent_color TEXT NOT NULL DEFAULT '#e1e100',
  avatar_image_id TEXT,
  background_image_id TEXT,
  links_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_aurapops_status_created
ON aurapops(status, created_at DESC);

CREATE TABLE IF NOT EXISTS aurapop_images (
  id TEXT PRIMARY KEY NOT NULL,
  pop_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('avatar','background')),
  content_type TEXT NOT NULL,
  image_bytes BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (pop_id) REFERENCES aurapops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aurapop_images_pop
ON aurapop_images(pop_id);
