-- Drop database and recreate it
DROP DATABASE IF EXISTS imagitales;
CREATE DATABASE imagitales;
USE imagitales;

-- Create themes table
CREATE TABLE themes (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10),
  color VARCHAR(20),
  created_at DATETIME NOT NULL
);

-- Create story_series table
CREATE TABLE story_series (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at DATETIME NOT NULL
);

-- Create stories table
CREATE TABLE stories (
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
  series_id VARCHAR(36) NULL,
  FOREIGN KEY (series_id) REFERENCES story_series(id) ON DELETE SET NULL
);

-- Create story_themes junction table
CREATE TABLE story_themes (
  id VARCHAR(36) PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  theme_id VARCHAR(36) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_story_theme (story_id, theme_id)
);

-- Create story versions table
CREATE TABLE story_versions (
  id VARCHAR(36) PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  age_group ENUM('2-3', '4-6', '7-9', '10-12', '13-15', '16-18') NOT NULL,
  created_at DATETIME NOT NULL,
  version INT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Create story_version_themes junction table
CREATE TABLE story_version_themes (
  id VARCHAR(36) PRIMARY KEY,
  story_version_id VARCHAR(36) NOT NULL,
  theme_id VARCHAR(36) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (story_version_id) REFERENCES story_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_version_theme (story_version_id, theme_id)
);

-- Create illustrations table
CREATE TABLE illustrations (
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
CREATE TABLE weekly_themes (
  week_number INT PRIMARY KEY,
  theme_name VARCHAR(255) NOT NULL,
  theme_description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_stories_age_group ON stories(age_group);
CREATE INDEX idx_stories_week_number ON stories(week_number);
CREATE INDEX idx_stories_locale ON stories(locale);
CREATE INDEX idx_story_versions_story_id ON story_versions(story_id);
CREATE INDEX idx_story_themes_story_id ON story_themes(story_id);
CREATE INDEX idx_story_themes_theme_id ON story_themes(theme_id);
CREATE INDEX idx_story_version_themes_version_id ON story_version_themes(story_version_id);
CREATE INDEX idx_story_version_themes_theme_id ON story_version_themes(theme_id);
CREATE INDEX idx_illustrations_story_id ON illustrations(story_id);