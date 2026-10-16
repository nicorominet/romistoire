import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const INIT_SCRIPT_PATH = path.join(__dirname, '../../scripts/init-db.sql');

// The script runs in the database of DB_NAME, on its own at startup: it must never drop data nor switch database
const FORBIDDEN = /^\s*(DROP|TRUNCATE|DELETE|USE|CREATE\s+DATABASE|ALTER\s+DATABASE)\b/i;

/**
 * Statements of the init script: "--" comment lines removed, split on ";".
 * @param {string} sql - Content of scripts/init-db.sql.
 * @returns {string[]}
 * @throws {Error} On a statement that could drop data or change the database.
 */
export const initStatements = (sql) => {
  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  const forbidden = statements.find((statement) => FORBIDDEN.test(statement));
  if (forbidden) throw new Error(`Init script refused, destructive statement: ${forbidden.slice(0, 60)}`);
  return statements;
};

/** @returns {string[]|null} Statements of scripts/init-db.sql, null when the file is missing. */
export const readInitStatements = () =>
  fs.existsSync(INIT_SCRIPT_PATH) ? initStatements(fs.readFileSync(INIT_SCRIPT_PATH, 'utf8')) : null;
