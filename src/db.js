import Database from 'better-sqlite3';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs/promises';
import { logger, isValidIdentifier } from './utils.js';
import { CHOICES } from './constants.js';
import { t } from './i18n.js';

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function selectDatabase(dbPath) {
  if (dbPath) {
    const resolvedPath = path.resolve(process.cwd(), dbPath);
    if (!(await fileExists(resolvedPath))) {
      const { createNew } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createNew',
          message: t('db.notFound', { dbPath }),
          default: true,
        },
      ]);
      if (!createNew) {
        logger.warn(t('common.cancel'));
        return null;
      }
      if (!resolvedPath.endsWith('.db') && !resolvedPath.endsWith('.sqlite')) {
        logger.error(t('db.fileTypeError'));
        return null;
      }
      logger.info(t('db.newDb', { dbName: path.basename(resolvedPath) }));
    }
    const db = new Database(resolvedPath);
    logger.success(t('db.connected', { dbName: path.basename(resolvedPath) }));
    return db;
  }

  const dbDir = process.cwd();
  const files = await fs.readdir(dbDir);
  const dbFiles = files.filter(
    (f) => f.endsWith('.db') || f.endsWith('.sqlite')
  );

  const databaseCountMessage =
    dbFiles.length > 0
      ? t('db.selectDb', { count: dbFiles.length })
      : t('db.selectDbNotFound');

  const { dbFile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'dbFile',
      message: databaseCountMessage,
      choices: [
        ...dbFiles,
        new inquirer.Separator(),
        { name: t('db.newDbChoice'), value: CHOICES.DB_NEW },
      ],
    },
  ]);

  let resolvedDbPath;
  if (dbFile === CHOICES.DB_NEW) {
    const { newDbName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newDbName',
        message: t('db.newDbPrompt'),
        validate: async (input) => {
          if (!input) return t('db.newDbValidateEmpty');
          if (!input.endsWith('.db') && !input.endsWith('.sqlite')) {
            return t('db.fileTypeError');
          }
          if (await fileExists(path.resolve(dbDir, input))) {
            return t('db.newDbValidateExists');
          }
          return true;
        },
      },
    ]);
    resolvedDbPath = path.resolve(dbDir, newDbName);
    logger.info(t('db.newDb', { dbName: newDbName }));
  } else {
    resolvedDbPath = path.resolve(dbDir, dbFile);
  }

  const db = new Database(resolvedDbPath);
  logger.success(t('db.connected', { dbName: path.basename(resolvedDbPath) }));
  return db;
}

export function closeDatabase(db) {
  db.close();
  logger.info(`\n${t('db.connectionClosed')}`);
}

export function getTables(db) {
  return db
    .prepare(
      `
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `
    )
    .all()
    .map((t) => t.name);
}

export function getPrimaryKey(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  try {
    const info = db.prepare(`PRAGMA table_info("${table}")`).all();
    const pk = info.find((col) => col.pk === 1);
    return pk ? pk.name : null;
  } catch (err) {
    logger.error(t('db.tableInfoError', { message: err.message }));
    return null;
  }
}

export function getAllRows(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  return db.prepare(`SELECT * FROM "${table}"`).all();
}

export function countRows(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  const { count } = db
    .prepare(`SELECT COUNT(*) as count FROM "${table}"`)
    .get();
  return count;
}

export function getRowsPaginated(db, table, limit, offset) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  return db
    .prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
    .all(limit, offset);
}

export function getSingleRow(db, table, idKey, rowId) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  if (!isValidIdentifier(idKey))
    throw new Error(`Invalid column name: ${idKey}`);
  return db.prepare(`SELECT * FROM "${table}" WHERE "${idKey}" = ?`).get(rowId);
}

export function getTableInfo(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  return db.prepare(`PRAGMA table_info("${table}")`).all();
}

export function executeCustomQuery(db, sql, params = []) {
  const trimmedSql = sql.trim().toUpperCase();
  if (!trimmedSql.startsWith('SELECT')) {
    throw new Error(t('db.readOnlyError'));
  }
  try {
    return db.prepare(sql).all(params);
  } catch (err) {
    throw new Error(t('db.queryError', { message: err.message }));
  }
}
