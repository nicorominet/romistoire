-- Tables of a new installation, created in the current database (DB_NAME in .env).
-- Run by the server at startup when the "stories" table is missing, or by hand:
--   mysql -u root -p <database> < scripts/init-db.sql
-- Never drops anything: every statement is "IF NOT EXISTS" (later columns and tables come from the migrations).
-- Statements are split on semicolons by the server: never put one inside a string.

-- Create themes table
CREATE TABLE IF NOT EXISTS themes (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  -- Comparison key: lowercase, no accents, no leading article (see shared/themeName.js)
  normalized_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(16),
  color VARCHAR(20),
  source ENUM('manual', 'ai') NOT NULL DEFAULT 'manual',
  -- AI-created themes stay "to review" until a human edits them
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NULL,
  UNIQUE INDEX uq_themes_normalized_name (normalized_name)
);

-- Create story_series table
CREATE TABLE IF NOT EXISTS story_series (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at DATETIME NOT NULL,
  parent_series_id VARCHAR(36) NULL,
  locale VARCHAR(5) NULL DEFAULT 'fr',
  INDEX idx_series_locale (locale),
  CONSTRAINT fk_series_parent FOREIGN KEY (parent_series_id) REFERENCES story_series(id) ON DELETE SET NULL
);

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  age_group ENUM('2-3', '4-6', '7-9', '10-12', '13-15', '16-18') NOT NULL,
  week_number INT NOT NULL DEFAULT 0,
  day_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  modified_at DATETIME NOT NULL,
  version INT NOT NULL DEFAULT 1,
  locale VARCHAR(5) NOT NULL DEFAULT 'en',
  source ENUM('manual', 'gemini', 'ollama') DEFAULT 'manual',
  is_manually_edited BOOLEAN DEFAULT FALSE,
  audio_path VARCHAR(255) NULL,
  illustration_prompt TEXT NULL,
  series_id VARCHAR(36) NULL,
  CONSTRAINT fk_stories_series FOREIGN KEY (series_id) REFERENCES story_series(id) ON DELETE SET NULL,
  INDEX idx_stories_age_group (age_group),
  INDEX idx_stories_week_number (week_number),
  INDEX idx_stories_locale (locale)
);

-- Create story_themes junction table
CREATE TABLE IF NOT EXISTS story_themes (
  id VARCHAR(36) PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  theme_id VARCHAR(36) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_story_theme (story_id, theme_id),
  INDEX idx_story_themes_story_id (story_id),
  INDEX idx_story_themes_theme_id (theme_id)
);

-- Create story versions table
CREATE TABLE IF NOT EXISTS story_versions (
  id VARCHAR(36) PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  age_group ENUM('2-3', '4-6', '7-9', '10-12', '13-15', '16-18') NOT NULL,
  created_at DATETIME NOT NULL,
  version INT NOT NULL,
  is_manually_edited BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  INDEX idx_story_versions_story_id (story_id)
);

-- Create story_version_themes junction table
CREATE TABLE IF NOT EXISTS story_version_themes (
  id VARCHAR(36) PRIMARY KEY,
  story_version_id VARCHAR(36) NOT NULL,
  theme_id VARCHAR(36) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (story_version_id) REFERENCES story_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_version_theme (story_version_id, theme_id),
  INDEX idx_story_version_themes_version_id (story_version_id),
  INDEX idx_story_version_themes_theme_id (theme_id)
);

-- Create illustrations table
CREATE TABLE IF NOT EXISTS illustrations (
  id VARCHAR(36) PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  position INT NOT NULL,
  created_at DATETIME NOT NULL,
  filename VARCHAR(255),
  file_type VARCHAR(100),
  image_path VARCHAR(255) NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Create weekly_themes table
CREATE TABLE IF NOT EXISTS weekly_themes (
  week_number INT PRIMARY KEY,
  -- Topic of the week (free text, not a story theme/tag)
  theme_name VARCHAR(255) NOT NULL,
  theme_description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
