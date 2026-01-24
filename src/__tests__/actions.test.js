import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTable,
  insertRow,
  updateRow,
  deleteRow,
  addColumn,
  dropColumn,
  renameTable,
  searchRows,
  updateMultipleRows,
  deleteMultipleRows,
} from '../actions.js';
import * as dbModule from '../db.js';
import * as utilsModule from '../utils.js';
import * as inquirerModule from 'inquirer';
import * as i18nModule from '../i18n.js';

vi.mock('../i18n.js', () => ({
  t: vi.fn((key) => key),
}));

vi.mock('../utils.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
  isValidIdentifier: vi.fn((input) => /^[a-zA-Z0-9_]+$/.test(input)),
  parseValueBasedOnOriginal: vi.fn((input, original) => {
    if (typeof original === 'number' && !isNaN(Number(input)))
      return Number(input);
    return input;
  }),
  parseValueBasedOnSchema: vi.fn((input, type) => {
    if (type === 'INTEGER' && !isNaN(Number(input))) return Number(input);
    return input;
  }),
}));

vi.mock('inquirer', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    default: {
      prompt: vi.fn(),
      Separator:
        original.Separator ||
        class {
          constructor() {
            this.type = 'separator';
          }
        },
    },
    Separator:
      original.Separator ||
      class {
        constructor() {
          this.type = 'separator';
        }
      },
  };
});

describe('actions.js', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER
            );
            INSERT INTO users (name, age) VALUES ('Alice', 30);
            INSERT INTO users (name, age) VALUES ('Bob', 25);
            INSERT INTO users (name, age) VALUES ('Charlie', 35);
        `);
    vi.clearAllMocks();
    if (
      inquirerModule.default &&
      typeof inquirerModule.default.prompt.mockClear === 'function'
    ) {
      inquirerModule.default.prompt.mockClear();
    }

    utilsModule.logger.error.mockClear();
    utilsModule.logger.warn.mockClear();
    utilsModule.logger.success.mockClear();
    utilsModule.logger.info.mockClear();
    utilsModule.logger.log.mockClear();

    if (vi.isMockFunction(dbModule.getTableInfo)) {
      dbModule.getTableInfo.mockRestore();
    }
  });

  describe('createTable', () => {
    it('should create a table with valid user input', async () => {
      inquirerModule.default.prompt
        .mockResolvedValueOnce({ tableName: 'new_users' })
        .mockResolvedValueOnce({
          name: 'id',
          type: 'INTEGER',
          pk: true,
          dflt_val: '',
          addMore: true,
        })
        .mockResolvedValueOnce({
          name: 'email',
          type: 'TEXT',
          pk: false,
          notnull: true,
          dflt_val: '',
          addMore: false,
        })
        .mockResolvedValueOnce({ confirm: true });

      await createTable(db);

      const tables = dbModule.getTables(db);
      expect(tables).toContain('new_users');
    });
  });

  describe('insertRow', () => {
    it('should insert a new row with valid user input', async () => {
      inquirerModule.default.prompt
        .mockResolvedValueOnce({ value: 'John Doe' })
        .mockResolvedValueOnce({ value: '30' })
        .mockResolvedValueOnce({ ok: true });

      await insertRow(db, 'users');

      const stmt = db.prepare('SELECT * FROM users WHERE name = ?');
      const user = stmt.get('John Doe');

      expect(user).toBeDefined();
      expect(user.age).toBe(30);
    });
  });

  describe('updateRow', () => {
    it('should update a specific row and column', async () => {
      const row = dbModule.getSingleRow(db, 'users', 'id', 1);
      inquirerModule.default.prompt
        .mockResolvedValueOnce({ column: 'name' })
        .mockResolvedValueOnce({ value: 'Alice Smith' })
        .mockResolvedValueOnce({ ok: true });

      await updateRow(db, 'users', 'id', row);

      const updatedRow = dbModule.getSingleRow(db, 'users', 'id', 1);
      expect(updatedRow.name).toBe('Alice Smith');
    });
  });

  describe('deleteRow', () => {
    it('should delete a specific row', async () => {
      inquirerModule.default.prompt.mockResolvedValueOnce({ ok: true });

      await deleteRow(db, 'users', 'id', 1);

      const deletedRow = db.prepare('SELECT * FROM users WHERE id = 1').get();
      expect(deletedRow).toBeUndefined();
    });
  });

  describe('addColumn', () => {
    it('should add a new column to an existing table', async () => {
      inquirerModule.default.prompt
        .mockResolvedValueOnce({
          name: 'email',
          type: 'TEXT',
          notnull: false,
          dflt_val: null,
        })
        .mockResolvedValueOnce({ confirm: true });

      await addColumn(db, 'users');

      const schema = dbModule.getTableInfo(db, 'users');
      const emailColumn = schema.find((col) => col.name === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn.type).toBe('TEXT');
    });

    it('should add a new column with NOT NULL and default value', async () => {
      vi.spyOn(dbModule, 'getTableInfo').mockImplementation((_db, table) => {
        if (table === 'users') {
          return [
            {
              cid: 0,
              name: 'id',
              type: 'INTEGER',
              notnull: 1,
              dflt_val: null,
              pk: 1,
            },
            {
              cid: 1,
              name: 'name',
              type: 'TEXT',
              notnull: 1,
              dflt_val: null,
              pk: 0,
            },
            {
              cid: 2,
              name: 'age',
              type: 'INTEGER',
              notnull: 0,
              dflt_val: null,
              pk: 0,
            },
            {
              cid: 3,
              name: 'status',
              type: 'TEXT',
              notnull: 1,
              dflt_val: "'active'",
              pk: 0,
            },
          ];
        }
        return dbModule.getTableInfo(_db, table);
      });

      inquirerModule.default.prompt
        .mockResolvedValueOnce({
          name: 'status',
          type: 'TEXT',
          notnull: true,
          dflt_val: 'active',
        })
        .mockResolvedValueOnce({ confirm: true });

      await addColumn(db, 'users');

      const schema = dbModule.getTableInfo(db, 'users');
      const statusColumn = schema.find((col) => col.name === 'status');
      expect(statusColumn).toBeDefined();
      expect(statusColumn.type).toBe('TEXT');
      expect(statusColumn.notnull).toBe(1);
      expect(statusColumn.dflt_val).toBe("'active'");

      db.exec("INSERT INTO users (name, age) VALUES ('David', 40);");
      const newRow = db
        .prepare("SELECT status FROM users WHERE name = 'David'")
        .get();
      expect(newRow.status).toBe('active');

      if (vi.isMockFunction(dbModule.getTableInfo)) {
        dbModule.getTableInfo.mockRestore();
      }
    });
  });

  describe('dropColumn', () => {
    it('should drop an existing column from a table', async () => {
      db.exec('ALTER TABLE users ADD COLUMN temp_col TEXT;');

      inquirerModule.default.prompt
        .mockResolvedValueOnce({ columnName: 'temp_col' })
        .mockResolvedValueOnce({ confirm: true });

      await dropColumn(db, 'users');

      const schema = dbModule.getTableInfo(db, 'users');
      const tempCol = schema.find((col) => col.name === 'temp_col');
      expect(tempCol).toBeUndefined();
    });

    it('should prevent dropping the last column', async () => {
      db.exec('CREATE TABLE single_col (col1 TEXT);');

      vi.spyOn(dbModule, 'getTableInfo').mockReturnValueOnce([
        {
          cid: 0,
          name: 'col1',
          type: 'TEXT',
          notnull: 0,
          dflt_val: null,
          pk: 0,
        },
      ]);
      i18nModule.t.mockImplementation((key) => {
        if (key === 'common.cancel') return 'Cancel';
        return key;
      });
      inquirerModule.default.prompt
        .mockResolvedValueOnce({ columnName: 'col1' })
        .mockResolvedValueOnce({ confirm: true });

      await dropColumn(db, 'single_col');

      expect(utilsModule.logger.error).toHaveBeenCalledWith(
        'actions.dropColumnLastError'
      );
      const schema = dbModule.getTableInfo(db, 'single_col');
      expect(schema).toHaveLength(1);
    });
  });

  describe('renameTable', () => {
    it('should rename an existing table', async () => {
      inquirerModule.default.prompt
        .mockResolvedValueOnce({ newTableName: 'people' })
        .mockResolvedValueOnce({ confirm: true });

      await renameTable(db, 'users');

      const tables = dbModule.getTables(db);
      expect(tables).not.toContain('users');
      expect(tables).toContain('people');
    });
  });

  describe('searchRows', () => {
    it('should return rows matching the where clause', () => {
      const results = searchRows(db, 'users', 'age > 28');
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Alice');
      expect(results[1].name).toBe('Charlie');
    });

    it('should return empty array if no rows match', () => {
      const results = searchRows(db, 'users', "name = 'NonExistent'");
      expect(results).toHaveLength(0);
    });
  });

  describe('updateMultipleRows', () => {
    it('should update multiple rows based on a where clause', async () => {
      inquirerModule.default.prompt
        .mockResolvedValueOnce({ column: 'age' })
        .mockResolvedValueOnce({ value: '31' })
        .mockResolvedValueOnce({ confirm: true });

      await updateMultipleRows(
        db,
        'users',
        "name = 'Alice' OR name = 'Bob'",
        2
      );

      const alice = db.prepare('SELECT * FROM users WHERE id = 1').get();
      const bob = db.prepare('SELECT * FROM users WHERE id = 2').get();
      const charlie = db.prepare('SELECT * FROM users WHERE id = 3').get();

      expect(alice.age).toBe(31);
      expect(bob.age).toBe(31);
      expect(charlie.age).toBe(35);
    });

    it('should not update if user cancels', async () => {
      inquirerModule.default.prompt
        .mockResolvedValueOnce({ column: 'age' })
        .mockResolvedValueOnce({ value: '99' })
        .mockResolvedValueOnce({ confirm: false });

      await updateMultipleRows(db, 'users', 'age > 20', 3);

      const users = db.prepare('SELECT age FROM users').all();
      expect(users.map((u) => u.age)).toEqual([30, 25, 35]);
      expect(utilsModule.logger.warn).toHaveBeenCalledWith(
        'actions.multiUpdate.cancelled'
      );
    });
  });

  describe('deleteMultipleRows', () => {
    it('should delete multiple rows based on a where clause', async () => {
      inquirerModule.default.prompt.mockResolvedValueOnce({ confirm: true });

      await deleteMultipleRows(db, 'users', 'age < 30', 1);

      const remainingUsers = db.prepare('SELECT * FROM users').all();
      expect(remainingUsers).toHaveLength(2);
      expect(remainingUsers.map((u) => u.name)).not.toContain('Bob');
    });

    it('should not delete if user cancels', async () => {
      inquirerModule.default.prompt.mockResolvedValueOnce({ confirm: false });

      await deleteMultipleRows(db, 'users', 'age < 30', 1);

      const remainingUsers = db.prepare('SELECT * FROM users').all();
      expect(remainingUsers).toHaveLength(3);
      expect(utilsModule.logger.warn).toHaveBeenCalledWith(
        'actions.multiDelete.cancelled'
      );
    });
  });
});
