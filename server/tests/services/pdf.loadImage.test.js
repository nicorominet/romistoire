import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ENV_CONFIG } from '../../config/env.config.js';
import { loadImage, resolveIllustrationPath } from '../../lib/pdf/helpers/loadImage.js';

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

describe('PDF export: illustrations are read from the uploads directory only', () => {
  const original = { root: ENV_CONFIG.PROJECT_ROOT, uploads: ENV_CONFIG.UPLOADS_DIR };
  let root;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'romistoire-pdf-'));
    fs.mkdirSync(path.join(root, 'uploads', '2026-10'), { recursive: true });
    fs.writeFileSync(path.join(root, 'uploads', '2026-10', 'a.png'), PNG);
    fs.writeFileSync(path.join(root, 'secret.png'), PNG);
    fs.writeFileSync(path.join(root, '.env'), 'GEMINI_API_KEY=x');
    ENV_CONFIG.PROJECT_ROOT = root;
    ENV_CONFIG.UPLOADS_DIR = path.join(root, 'uploads');
  });

  afterAll(() => {
    ENV_CONFIG.PROJECT_ROOT = original.root;
    ENV_CONFIG.UPLOADS_DIR = original.uploads;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it.each(['uploads/2026-10/a.png', '/uploads/2026-10/a.png', 'uploads\\2026-10\\a.png'])('reads %s', (imagePath) => {
    expect(loadImage({ image_path: imagePath })).toMatchObject({ type: 'PNG' });
  });

  it.each([
    'secret.png',
    '.env',
    'uploads/../secret.png',
    'uploads/../../etc/passwd',
    '/etc/passwd',
    'uploads/2026-10/../../.env',
    'uploads',
    'uploads/2026-10/a.txt'
  ])('refuses %s', (imagePath) => {
    expect(resolveIllustrationPath(imagePath)).toBeNull();
    expect(loadImage({ image_path: imagePath })).toBeNull();
  });
});
