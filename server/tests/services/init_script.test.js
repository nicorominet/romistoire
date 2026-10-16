import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { INIT_SCRIPT_PATH, initStatements, readInitStatements } from '../../config/init_script.js';

describe('init-db.sql (run on its own at startup on a new database)', () => {
  it('never drops a database nor switches to another one', () => {
    const sql = fs.readFileSync(INIT_SCRIPT_PATH, 'utf8');
    expect(sql).not.toMatch(/DROP\s+DATABASE|CREATE\s+DATABASE|^\s*USE\s/im);
  });

  it('creates every table only when missing', () => {
    const statements = readInitStatements();
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(/^CREATE TABLE IF NOT EXISTS \w+ \(/);
    }
  });

  it('has no ";" inside a comment (statements are split on it)', () => {
    const commentsWithSemicolon = fs.readFileSync(INIT_SCRIPT_PATH, 'utf8').split('\n')
      .filter((line) => line.trim().startsWith('--') && line.includes(';'));
    expect(commentsWithSemicolon).toEqual([]);
  });
});

describe('initStatements', () => {
  it('drops comment lines and empty statements', () => {
    expect(initStatements('-- a; b\nCREATE TABLE IF NOT EXISTS t (id INT);\n\n-- end\n')).toEqual(['CREATE TABLE IF NOT EXISTS t (id INT)']);
  });

  it.each(['DROP DATABASE imagitales', 'USE other', 'CREATE DATABASE x', 'TRUNCATE stories', 'drop table stories'])(
    'refuses a destructive statement: %s', (statement) => {
      expect(() => initStatements(`CREATE TABLE IF NOT EXISTS t (id INT);\n${statement};`)).toThrow(/refused/);
    });
});
