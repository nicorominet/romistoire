import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readLastLines } from '../../lib/tail.js';
import { rotateDebugLog } from '../../config/logger.js';
import { dirUsage } from '../../services/system.service.js';

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'romistoire-logs-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('readLastLines', () => {
  it('reads the end of a large file only', async () => {
    const file = path.join(dir, 'logs.jsonl');
    // ~1.2 MB, lines crossing the 64 KB chunks
    fs.writeFileSync(file, Array.from({ length: 20000 }, (_, i) => JSON.stringify({ i, pad: 'x'.repeat(50) })).join('\n') + '\n');

    const lines = await readLastLines(file, 3);

    expect(lines.map((line) => JSON.parse(line).i)).toEqual([19997, 19998, 19999]);
  });

  it('returns the whole file when it is shorter, and [] when missing', async () => {
    const file = path.join(dir, 'short.jsonl');
    fs.writeFileSync(file, 'a\n\nb\n');
    expect(await readLastLines(file, 10)).toEqual(['a', 'b']);
    expect(await readLastLines(path.join(dir, 'missing.jsonl'), 10)).toEqual([]);
  });

  it('never returns a line cut at a chunk boundary', async () => {
    const file = path.join(dir, 'long-lines.jsonl');
    const line = (i) => `${i}:${'y'.repeat(70000)}`;
    fs.writeFileSync(file, [line(1), line(2), line(3)].join('\n'));
    const lines = await readLastLines(file, 2);
    expect(lines).toEqual([line(2), line(3)]);
  });
});

describe('rotateDebugLog', () => {
  it('renames the file beyond the size limit, keeps it below', async () => {
    const file = path.join(dir, 'logs.jsonl');
    fs.writeFileSync(file, 'x'.repeat(100));

    expect(await rotateDebugLog(200, file)).toBe(false);
    expect(await rotateDebugLog(50, file)).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'logs.1.jsonl'), 'utf8')).toHaveLength(100);
    expect(await rotateDebugLog(50, file)).toBe(false); // missing file
  });
});

describe('dirUsage', () => {
  it('counts files and bytes recursively, zeros for a missing folder', async () => {
    fs.mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a', 'one.png'), 'xx');
    fs.writeFileSync(path.join(dir, 'a', 'b', 'two.png'), 'xxx');

    expect(await dirUsage(dir)).toEqual({ files: 2, bytes: 5 });
    expect(await dirUsage(path.join(dir, 'missing'))).toEqual({ files: 0, bytes: 0 });
  });
});
