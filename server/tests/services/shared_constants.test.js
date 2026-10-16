import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ENV_CONFIG } from '../../config/env.config.js';
import { AGE_GROUPS } from '../../../shared/ageGroups.js';
import { ACCEPTED_IMAGE_TYPES, IMAGE_EXTENSIONS } from '../../../shared/images.js';

const read = (file) => fs.readFileSync(path.join(ENV_CONFIG.PROJECT_ROOT, file), 'utf8');

describe('shared/ageGroups.js and the schema', () => {
  it('every age_group ENUM of the init script and of the migrations lists exactly AGE_GROUPS', () => {
    const sources = [read('scripts/init-db.sql'), read('server/config/database.js')];
    const enums = sources.flatMap((sql) => [...sql.matchAll(/age_group\s+ENUM\(([^)]*)\)/gi)].map((m) => m[1]));

    expect(enums.length).toBeGreaterThanOrEqual(3);
    for (const values of enums) {
      expect([...values.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...AGE_GROUPS]);
    }
  });
});

describe('shared/images.js', () => {
  it('accepts exactly the types the upload filter knows', () => {
    expect([...ACCEPTED_IMAGE_TYPES]).toEqual(Object.keys(IMAGE_EXTENSIONS));
    expect(Object.values(IMAGE_EXTENSIONS).every((ext) => /^\.[a-z]+$/.test(ext))).toBe(true);
  });
});
