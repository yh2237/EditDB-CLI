import inquirer from 'inquirer';
import { getTableInfo, getSingleRow, executeCustomQuery } from './db.js';
import {
  parseValueBasedOnOriginal,
  parseValueBasedOnSchema,
  logger,
  isValidIdentifier,
} from './utils.js';
import { t } from './i18n.js';

async function selectColumn(row) {
  const keys = Object.keys(row);

  const { column } = await inquirer.prompt([
    {
      type: 'list',
      name: 'column',
      message: t('actions.selectColumn'),
      choices: keys,
    },
  ]);

  const originalValue = row[column];

  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: t('actions.newValuePrompt', {
        value: originalValue,
        type: typeof originalValue,
      }),
      validate: (input) => {
        const parsed = parseValueBasedOnOriginal(input, originalValue);
        if (parsed === undefined) {
          return t('actions.invalidInput', { type: typeof originalValue });
        }
        return true;
      },
    },
  ]);

  const newValue = parseValueBasedOnOriginal(value, originalValue);
  return { column, newValue };
}

async function confirmUpdate(db, table, idKey, rowId, column, newValue) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  if (!isValidIdentifier(column))
    throw new Error(`Invalid column name: ${column}`);

  logger.log(t('actions.updateHeader'));
  logger.log(t('actions.updateTable', { table }));
  logger.log(t('actions.updateRow', { idKey, rowId }));
  logger.log(t('actions.updateColumn', { column }));
  logger.log(t('actions.updateValue', { value: newValue }));
  logger.log(t('actions.updateFooter'));

  const { ok } = await inquirer.prompt([
    { type: 'confirm', name: 'ok', message: t('common.confirm') },
  ]);

  if (!ok) {
    logger.warn(t('common.cancel'));
    return;
  }

  try {
    const stmt = db.prepare(
      `UPDATE "${table}" SET "${column}" = ? WHERE "${idKey}" = ?`
    );
    stmt.run(newValue, rowId);

    const updated = getSingleRow(db, table, idKey, rowId);
    logger.success(t('actions.updateSuccess'));
    logger.log(updated);
  } catch (err) {
    logger.error(t('actions.updateError', { message: err.message }));
  }
}

export async function updateRow(db, table, idKey, row) {
  const { column, newValue } = await selectColumn(row);
  await confirmUpdate(db, table, idKey, row[idKey], column, newValue);
}

export async function insertRow(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  logger.log(t('actions.insertHeader', { table }));
  try {
    const columns = getTableInfo(db, table);
    const newRow = {};

    for (const column of columns) {
      if (column.pk === 1 && column.type.toUpperCase() === 'INTEGER') {
        logger.info(t('actions.pkAuto', { name: column.name }));
        continue;
      }

      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: t('actions.columnValuePrompt', {
            name: column.name,
            type: column.type,
            default: column.dflt_val || 'NULL',
          }),
          validate: (input) => {
            if (input === '' && column.dflt_val !== null) return true;
            if (input.toLowerCase() === 'null' && column.notnull)
              return t('actions.notNullError');
            const parsed = parseValueBasedOnSchema(input, column.type);
            if (parsed === undefined) {
              return t('actions.invalidInput', { type: column.type });
            }
            return true;
          },
        },
      ]);

      if (value === '' && column.dflt_val !== null) {
        newRow[column.name] = null;
      } else {
        newRow[column.name] = parseValueBasedOnSchema(value, column.type);
      }
    }

    logger.log(t('actions.insertContentHeader'));
    logger.log(newRow);
    logger.log(t('actions.insertContentFooter'));

    const { ok } = await inquirer.prompt([
      { type: 'confirm', name: 'ok', message: t('common.confirm') },
    ]);

    if (!ok) {
      logger.warn(t('actions.insertCancelled'));
      return;
    }

    const keys = Object.keys(newRow).filter((k) => newRow[k] !== null);
    keys.forEach((k) => {
      if (!isValidIdentifier(k)) throw new Error(`Invalid column name: ${k}`);
    });
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${placeholders})`;
    const values = keys.map((k) => newRow[k]);

    const stmt = db.prepare(sql);
    const result = stmt.run(values);

    if (result.changes > 0) {
      logger.success(
        t('actions.insertSuccess', { rowid: result.lastInsertRowid })
      );
    } else {
      logger.warn(t('actions.insertWarning'));
    }
  } catch (err) {
    logger.error(t('actions.insertError', { message: err.message }));
  }
}

export async function deleteRow(db, table, idKey, rowId) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  if (!isValidIdentifier(idKey))
    throw new Error(`Invalid column name: ${idKey}`);

  logger.log(t('actions.deleteHeader'));
  logger.log(t('actions.updateTable', { table }));
  logger.log(t('actions.updateRow', { idKey, rowId }));
  logger.log('--------------------');

  const { ok } = await inquirer.prompt([
    { type: 'confirm', name: 'ok', message: t('actions.deleteConfirm') },
  ]);

  if (!ok) {
    logger.warn(t('common.cancel'));
    return;
  }

  try {
    const stmt = db.prepare(`DELETE FROM "${table}" WHERE "${idKey}" = ?`);
    const result = stmt.run(rowId);

    if (result.changes > 0) {
      logger.success(t('actions.deleteSuccess'));
    } else {
      logger.warn(t('actions.deleteWarning'));
    }
  } catch (err) {
    logger.error(t('actions.deleteError', { message: err.message }));
  }
}

export async function createTable(db) {
  logger.log(t('actions.createTableHeader'));

  const { tableName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tableName',
      message: t('actions.tableNamePrompt'),
      validate: (input) => {
        if (!input) return t('actions.tableNameValidateEmpty');
        if (!isValidIdentifier(input))
          return t('actions.tableNameValidateInvalid');
        return true;
      },
    },
  ]);

  const columns = [];
  let addMore = true;

  while (addMore) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: t('actions.columnNamePrompt'),
        validate: (input) => {
          if (!input) return t('actions.columnNameValidateEmpty');
          if (!isValidIdentifier(input))
            return t('actions.columnNameValidateInvalid');
          return true;
        },
      },
      {
        type: 'list',
        name: 'type',
        message: t('actions.columnTypePrompt'),
        choices: ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC'],
      },
      {
        type: 'confirm',
        name: 'pk',
        message: t('actions.pkPrompt'),
        default: false,
      },
      {
        type: 'confirm',
        name: 'notnull',
        message: t('actions.notNullPrompt'),
        default: false,
        when: (a) => !a.pk,
      },
      {
        type: 'input',
        name: 'dflt_val',
        message: t('actions.defaultValuePrompt'),
      },
      {
        type: 'confirm',
        name: 'addMore',
        message: t('actions.addMoreColumnsPrompt'),
        default: true,
      },
    ]);

    let columnDef = `"${answers.name}" ${answers.type}`;
    if (answers.pk) columnDef += ' PRIMARY KEY';
    if (answers.notnull && !answers.pk) columnDef += ' NOT NULL';

    if (answers.dflt_val) {
      const val = answers.dflt_val;
      const upperVal = val.toUpperCase();
      const isNumeric = !isNaN(parseFloat(val)) && isFinite(val);
      const isKeyword = [
        'CURRENT_TIME',
        'CURRENT_DATE',
        'CURRENT_TIMESTAMP',
        'NULL',
      ].includes(upperVal);

      if (isNumeric || isKeyword) {
        columnDef += ` DEFAULT ${val}`;
      } else {
        columnDef += ` DEFAULT '${val.replace(/'/g, "''")}'`;
      }
    }

    columns.push(columnDef);
    addMore = answers.addMore;
  }

  if (columns.length === 0) {
    logger.warn(t('actions.createTableCancel'));
    return;
  }

  const createSql = `CREATE TABLE "${tableName}" (${columns.join(',\n  ')});`;

  logger.log(t('actions.sqlHeader'));
  logger.log(createSql);
  logger.log(t('actions.sqlFooter'));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: t('actions.sqlConfirm'),
      default: true,
    },
  ]);

  if (confirm) {
    try {
      db.prepare(createSql).run();
      logger.success(t('actions.createSuccess', { tableName }));
    } catch (err) {
      logger.error(t('actions.createError', { message: err.message }));
    }
  } else {
    logger.warn(t('actions.createCancelled'));
  }
}

export async function executeCustomQueryAction(db) {
  logger.log(t('actions.customQueryHeader'));
  const { sql } = await inquirer.prompt([
    {
      type: 'input',
      name: 'sql',
      message: t('actions.customQueryPrompt'),
      validate: (input) =>
        !!input.trim() || t('actions.customQueryValidateEmpty'),
    },
  ]);

  try {
    const results = executeCustomQuery(db, sql);
    if (results.length > 0) {
      logger.success(t('actions.customQueryResultHeader'));
      console.table(results);
      logger.info(t('actions.customQueryResultFooter'));
    } else {
      logger.warn(t('actions.customQueryNoResult'));
    }
  } catch (err) {
    logger.error(t('actions.customQueryError', { message: err.message }));
  }
}

export async function addColumn(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  logger.log(t('actions.addColumnHeader', { table }));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: t('actions.columnNamePrompt'),
      validate: (input) => {
        if (!input) return t('actions.columnNameValidateEmpty');
        if (!isValidIdentifier(input))
          return t('actions.columnNameValidateInvalid');
        return true;
      },
    },
    {
      type: 'list',
      name: 'type',
      message: t('actions.columnTypePrompt'),
      choices: ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC'],
    },
    {
      type: 'confirm',
      name: 'notnull',
      message: t('actions.notNullPrompt'),
      default: false,
    },
    {
      type: 'input',
      name: 'dflt_val',
      message: t('actions.defaultValuePrompt'),
    },
  ]);

  let columnDef = `"${answers.name}" ${answers.type}`;
  if (answers.notnull) columnDef += ' NOT NULL';
  if (answers.dflt_val) {
    const val = answers.dflt_val;
    const upperVal = val.toUpperCase();
    const isNumeric = !isNaN(parseFloat(val)) && isFinite(val);
    const isKeyword = [
      'CURRENT_TIME',
      'CURRENT_DATE',
      'CURRENT_TIMESTAMP',
      'NULL',
    ].includes(upperVal);

    if (isNumeric || isKeyword) {
      columnDef += ` DEFAULT ${val}`;
    } else {
      columnDef += ` DEFAULT '${val.replace(/'/g, "''")}'`;
    }
  }

  const sql = `ALTER TABLE "${table}" ADD COLUMN ${columnDef};`;

  logger.log(t('actions.sqlHeader'));
  logger.log(sql);
  logger.log(t('actions.sqlFooter'));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: t('actions.sqlConfirm'),
      default: true,
    },
  ]);

  if (confirm) {
    try {
      db.prepare(sql).run();
      logger.success(
        t('actions.addColumnSuccess', { name: answers.name, table })
      );
    } catch (err) {
      logger.error(t('actions.alterError', { message: err.message }));
    }
  } else {
    logger.warn(t('actions.alterCancelled'));
  }
}

export async function dropColumn(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);

  const columns = getTableInfo(db, table);
  if (columns.length <= 1) {
    logger.error(t('actions.dropColumnLastError'));
    return;
  }

  const columnNames = columns.map((c) => c.name);
  const { columnName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'columnName',
      message: t('actions.dropColumnPrompt'),
      choices: [...columnNames, new inquirer.Separator(), t('common.cancel')],
    },
  ]);

  if (columnName === t('common.cancel') || !columnName) {
    logger.warn(t('actions.alterCancelled'));
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: t('actions.dropColumnConfirm', {
        columnName: columnName,
        table: table,
      }),
      default: true,
    },
  ]);

  if (!confirm) {
    logger.warn(t('actions.alterCancelled'));
    return;
  }

  const tempTable = `_temp_${table}`;
  const remainingColumns = columns.filter((c) => c.name !== columnName);
  const remainingColumnNames = remainingColumns
    .map((c) => `"${c.name}"`)
    .join(', ');

  const createTableSql = `CREATE TABLE "${tempTable}" (${remainingColumns
    .map((c) => {
      let def = `"${c.name}" ${c.type}`;
      if (c.pk) def += ' PRIMARY KEY';
      if (c.notnull) def += ' NOT NULL';
      if (c.dflt_value) def += ` DEFAULT ${c.dflt_value}`;
      return def;
    })
    .join(', ')});`;
  const insertDataSql = `INSERT INTO "${tempTable}" (${remainingColumnNames}) SELECT ${remainingColumnNames} FROM "${table}";`;
  const dropOldTableSql = `DROP TABLE "${table}";`;
  const renameTableSql = `ALTER TABLE "${tempTable}" RENAME TO "${table}";`;

  const transaction = db.transaction(() => {
    db.exec(createTableSql);
    db.exec(insertDataSql);
    db.exec(dropOldTableSql);
    db.exec(renameTableSql);
  });

  try {
    transaction();
    logger.success(t('actions.dropColumnSuccess', { name: columnName, table }));
  } catch (err) {
    logger.error(t('actions.alterError', { message: err.message }));
  }
}

export async function renameTable(db, table) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  logger.log(t('actions.renameTableHeader', { table }));

  const { newTableName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newTableName',
      message: t('actions.renameTablePrompt'),
      validate: (input) => {
        if (!input) return t('actions.tableNameValidateEmpty');
        if (!isValidIdentifier(input))
          return t('actions.tableNameValidateInvalid');
        return true;
      },
    },
  ]);

  const sql = `ALTER TABLE "${table}" RENAME TO "${newTableName}";`;
  logger.log(t('actions.sqlHeader'));
  logger.log(sql);
  logger.log(t('actions.sqlFooter'));
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: t('actions.sqlConfirm'),
      default: true,
    },
  ]);

  if (confirm) {
    try {
      db.prepare(sql).run();
      logger.success(
        t('actions.renameTableSuccess', { old: table, new: newTableName })
      );
      return newTableName;
    } catch (err) {
      logger.error(t('actions.alterError', { message: err.message }));
      return null;
    }
  } else {
    logger.warn(t('actions.alterCancelled'));
    return null;
  }
}

export function searchRows(db, table, whereClause, params) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);
  const sql = `SELECT * FROM "${table}" WHERE ${whereClause}`;
  return db.prepare(sql).all(params);
}

export async function updateMultipleRows(
  db,
  table,
  whereClause,
  params,
  rowCount
) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);

  logger.log(
    t('actions.multiUpdate.header', {
      count: rowCount,
      table,
      where: whereClause.replace(
        /\?/g,
        (
          (i) => () =>
            params[i++]
        )(0)
      ),
    })
  );

  const columns = getTableInfo(db, table).map((c) => c.name);
  const { column } = await inquirer.prompt([
    {
      type: 'list',
      name: 'column',
      message: t('actions.multiUpdate.selectColumn'),
      choices: columns,
    },
  ]);

  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: t('actions.multiUpdate.newValuePrompt', { column }),
    },
  ]);

  if (!isValidIdentifier(column))
    throw new Error(`Invalid column name: ${column}`);
  const sql = `UPDATE "${table}" SET "${column}" = ? WHERE ${whereClause}`;

  logger.log(t('actions.sqlHeader'));
  logger.log(sql);
  logger.log(t('actions.sqlFooter'));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: t('actions.multiUpdate.confirm', { count: rowCount }),
      default: false,
    },
  ]);

  if (confirm) {
    try {
      const result = db.prepare(sql).run(value, ...params);
      logger.success(
        t('actions.multiUpdate.success', { count: result.changes })
      );
    } catch (err) {
      logger.error(t('actions.updateError', { message: err.message }));
    }
  } else {
    logger.warn(t('actions.multiUpdate.cancelled'));
  }
}

export async function deleteMultipleRows(
  db,
  table,
  whereClause,
  params,
  rowCount
) {
  if (!isValidIdentifier(table))
    throw new Error(`Invalid table name: ${table}`);

  logger.log(
    t('actions.multiDelete.header', {
      count: rowCount,
      table,
      where: whereClause.replace(
        /\?/g,
        (
          (i) => () =>
            params[i++]
        )(0)
      ),
    })
  );

  const sql = `DELETE FROM "${table}" WHERE ${whereClause}`;

  logger.log(t('actions.sqlHeader'));
  logger.log(sql);
  logger.log(t('actions.sqlFooter'));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: t('actions.multiDelete.confirm', { count: rowCount }),
      default: false,
    },
  ]);

  if (confirm) {
    try {
      const result = db.prepare(sql).run(params);
      logger.success(
        t('actions.multiDelete.success', { count: result.changes })
      );
    } catch (err) {
      logger.error(t('actions.deleteError', { message: err.message }));
    }
  } else {
    logger.warn(t('actions.multiDelete.cancelled'));
  }
}
