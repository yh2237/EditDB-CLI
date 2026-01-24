import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  getTables,
  getPrimaryKey,
  getAllRows,
  countRows,
  getRowsPaginated,
  getSingleRow,
  getTableInfo,
  executeCustomQuery,
} from '../db.js';
import * as i18nModule from '../i18n.js';

vi.mock('../i18n.js', () => ({
  t: vi.fn((key) => key),
  init: vi.fn(),
}));

describe('db.js', () => {
  let db;

  beforeEach(async () => {
    vi.clearAllMocks();
    if (vi.isMockFunction(i18nModule.t)) {
      i18nModule.t.mockImplementation((key) => {
        if (key === 'db.readOnlyError') return 'Read-only SELECT queries only.';
        return key;
      });
    }

    i18nModule.init('en');

    db = new Database(':memory:');
    db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER
            );
        `);
    db.exec(`
            INSERT INTO users (name, age) VALUES
            ('Alice', 30),
            ('Bob', 25),
            ('Charlie', 35);
        `);
  });

  it('should get all table names', () => {
    const tables = getTables(db);
    expect(tables).toEqual(['users']);
  });

  it('should get the primary key of a table', () => {
    const pk = getPrimaryKey(db, 'users');
    expect(pk).toBe('id');
  });

  it('should return null if no primary key exists', () => {
    db.exec('CREATE TABLE no_pk (col1 TEXT);');
    const pk = getPrimaryKey(db, 'no_pk');
    expect(pk).toBeNull();
  });

  it('should get all rows from a table', () => {
    const rows = getAllRows(db, 'users');
    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe('Alice');
  });

  it('should count the rows in a table', () => {
    const count = countRows(db, 'users');
    expect(count).toBe(3);
  });

  it('should get paginated rows', () => {
    const rows = getRowsPaginated(db, 'users', 2, 1);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Bob');
    expect(rows[1].name).toBe('Charlie');
  });

  it('should get a single row by its primary key', () => {
    const row = getSingleRow(db, 'users', 'id', 2);
    expect(row).toBeDefined();
    expect(row.name).toBe('Bob');
  });

  it('should get table schema information', () => {
    const info = getTableInfo(db, 'users');
    expect(info).toHaveLength(3);
    expect(info[0].name).toBe('id');
    expect(info[0].type).toBe('INTEGER');
    expect(info[0].pk).toBe(1);
  });

  describe('executeCustomQuery', () => {
    it('should execute a custom SELECT query', () => {
      const results = executeCustomQuery(
        db,
        'SELECT name FROM users WHERE age > 30'
      );
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Charlie');
    });

    it('should return an empty array for SELECT queries with no results', () => {
      const results = executeCustomQuery(
        db,
        'SELECT * FROM users WHERE age > 100'
      );
      expect(results).toHaveLength(0);
    });

    it('should throw an error for non-SELECT custom queries', () => {
      expect(() => executeCustomQuery(db, 'DELETE FROM users')).toThrowError(
        'Read-only SELECT queries only.'
      );
      expect(() =>
        executeCustomQuery(db, "INSERT INTO users (name) VALUES ('Dave')")
      ).toThrowError('Read-only SELECT queries only.');
      expect(() =>
        executeCustomQuery(db, "UPDATE users SET name = 'NewName' WHERE id = 1")
      ).toThrowError('Read-only SELECT queries only.');
    });
  });
});
