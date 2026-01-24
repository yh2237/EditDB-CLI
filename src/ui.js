import inquirer from 'inquirer';
import {
  getTables,
  getPrimaryKey,
  getSingleRow,
  getTableInfo,
  countRows,
  getRowsPaginated,
} from './db.js';
import {
  updateRow,
  deleteRow,
  insertRow,
  addColumn,
  dropColumn,
  renameTable,
  searchRows,
  updateMultipleRows,
  deleteMultipleRows,
} from './actions.js';
import { logger } from './utils.js';
import { config } from './config.js';
import { t } from './i18n.js';
import {
    CHOICES,
    PAGINATION,
    UI_ACTIONS,
    ROW_ACTIONS,
    ALTER_TABLE_ACTIONS,
    MULTI_ROW_ACTIONS,
} from './constants.js';

const PAGE_SIZE = config.PAGE_SIZE;

export async function selectTable(db) {
  const tables = getTables(db);

  const choices = [];
  const tableCountMessage =
    tables.length > 0
      ? t('ui.selectTable', { count: tables.length })
      : t('ui.selectTableNotFound');

  if (tables.length > 0) {
    choices.push(new inquirer.Separator('--- Existing Tables ---'));
    choices.push(...tables);
  }

  choices.push(
    new inquirer.Separator(),
    { name: t('ui.newTableChoice'), value: CHOICES.TABLE_NEW },
    { name: t('actions.customQueryHeader'), value: CHOICES.TABLE_CUSTOM_QUERY },
    { name: t('ui.exitChoice'), value: CHOICES.EXIT }
  );

  const { table } = await inquirer.prompt([
    {
      type: 'list',
      name: 'table',
      message: tableCountMessage,
      choices: choices,
    },
  ]);

  return table;
}

async function selectRow(db, table) {
  const totalRows = countRows(db, table);
  if (totalRows === 0) {
    logger.warn(t('ui.noRows'));
    return {};
  }

  let idKey = getPrimaryKey(db, table);
  if (!idKey) {
    logger.warn(t('ui.pkNotFound'));
    const columns = getTableInfo(db, table).map((c) => c.name);
    ({ idKey } = await inquirer.prompt([
      {
        type: 'list',
        name: 'idKey',
        message: t('ui.selectUniqueColumn'),
        choices: columns,
      },
    ]));
  } else {
    logger.info(t('ui.pkFound', { idKey }));
  }

  const PAGE_SIZE = config.PAGE_SIZE;
  let offset = 0;

  while (true) {
    const rows = getRowsPaginated(db, table, PAGE_SIZE, offset);
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.ceil(totalRows / PAGE_SIZE);

    const { rowId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'rowId',
        message: t('ui.selectRow', { currentPage, totalPages }),
        choices: [
          ...rows.map((r) => {
            const displayKeys = Object.keys(r)
              .filter((k) => k !== idKey)
              .slice(0, 3);
            const displayPairs = displayKeys
              .map((k) => {
                let val = r[k];
                if (typeof val === 'string' && val.length > 20) {
                  val = val.substring(0, 17) + '...';
                } else if (val === null) {
                  val = 'NULL';
                }
                return `${k}: ${val}`;
              })
              .join(' | ');

            const remainingCount =
              Object.keys(r).length -
              displayKeys.length -
              (Object.keys(r).includes(idKey) ? 1 : 0);
            const moreText =
              remainingCount > 0 ? ` (+${remainingCount} more)` : '';

            return {
              name: `${idKey}: ${r[idKey]} | ${displayPairs}${moreText}`,
              value: r[idKey],
            };
          }),
          new inquirer.Separator(),
          {
            name: t('ui.nextPage'),
            value: PAGINATION.NEXT,
            disabled: offset + PAGE_SIZE >= totalRows,
          },
          { name: t('ui.prevPage'), value: PAGINATION.PREV, disabled: offset === 0 },
          { name: t('common.back'), value: UI_ACTIONS.BACK },
        ],
      },
    ]);

    if (rowId === PAGINATION.NEXT) {
      offset += PAGE_SIZE;
    } else if (rowId === PAGINATION.PREV) {
      offset -= PAGE_SIZE;
    } else if (rowId === UI_ACTIONS.BACK) {
      return {};
    } else {
      return { idKey, row: getSingleRow(db, table, idKey, rowId) };
    }
  }
}

async function rowActionPrompt(db, table, idKey, row) {
  let currentRow = row;
  while (true) {
    logger.log(t('ui.selectedRow'), currentRow);
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('ui.rowAction'),
        choices: [
          { name: t('ui.editColumn'), value: ROW_ACTIONS.EDIT },
          { name: t('ui.deleteRow'), value: ROW_ACTIONS.DELETE },
          new inquirer.Separator(),
          { name: t('ui.selectAnotherRow'), value: UI_ACTIONS.BACK },
        ],
      },
    ]);

    if (action === ROW_ACTIONS.EDIT) {
      await updateRow(db, table, idKey, currentRow);
      const updatedRow = getSingleRow(db, table, idKey, currentRow[idKey]);
      if (updatedRow) {
        currentRow = updatedRow;
      } else {
        logger.warn(t('actions.deleteWarning'));
        return;
      }
    } else if (action === ROW_ACTIONS.DELETE) {
      await deleteRow(db, table, idKey, currentRow[idKey]);
      return;
    } else if (action === UI_ACTIONS.BACK) {
      return;
    }
  }
}

function displaySchema(db, table) {
  const schema = getTableInfo(db, table);
  logger.info(t('ui.schemaHeader', { table }));
  console.table(schema);
  logger.info(t('ui.schemaFooter'));
}

async function alterTablePrompt(db, table) {
  let currentTable = table;
  while (true) {
    displaySchema(db, currentTable);
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('ui.alterTable.message'),
        choices: [
          {
            name: t('ui.alterTable.addColumn'),
            value: ALTER_TABLE_ACTIONS.ADD_COLUMN,
          },
          {
            name: t('ui.alterTable.dropColumn'),
            value: ALTER_TABLE_ACTIONS.DROP_COLUMN,
          },
          {
            name: t('ui.alterTable.renameTable'),
            value: ALTER_TABLE_ACTIONS.RENAME_TABLE,
          },
          new inquirer.Separator(),
          { name: t('common.back'), value: UI_ACTIONS.BACK },
        ],
      },
    ]);

    switch (action) {
      case ALTER_TABLE_ACTIONS.ADD_COLUMN:
        await addColumn(db, currentTable);
        break;
      case ALTER_TABLE_ACTIONS.DROP_COLUMN:
        await dropColumn(db, currentTable);
        break;
      case ALTER_TABLE_ACTIONS.RENAME_TABLE:
        const newTableName = await renameTable(db, currentTable);
        if (newTableName) {
          currentTable = newTableName;
        }
        break;
      case UI_ACTIONS.BACK:
        return currentTable;
    }
  }
}

async function buildWhereClause(db, table) {
  const columns = getTableInfo(db, table).map((c) => c.name);
  const conditions = [];
  const params = [];

  let addMore = true;
  while (addMore) {
    const { column } = await inquirer.prompt([
      {
        type: 'list',
        name: 'column',
        message: t('ui.multiRow.selectColumn'),
        choices: columns,
      },
    ]);

    const { operator } = await inquirer.prompt([
      {
        type: 'list',
        name: 'operator',
        message: t('ui.multiRow.selectOperator'),
        choices: [
          '=',
          '!=',
          '>',
          '<',
          '>=',
          '<=',
          'LIKE',
          'IN',
          'IS NULL',
          'IS NOT NULL',
        ],
      },
    ]);

    let value;
    if (operator !== 'IS NULL' && operator !== 'IS NOT NULL') {
      ({ value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message: t('ui.multiRow.enterValue'),
        },
      ]));
    }

    let condition;
    if (operator === 'IN') {
      const values = value.split(',').map((v) => v.trim());
      condition = `"${column}" IN (${values.map(() => '?').join(',')})`;
      params.push(...values);
    } else if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      condition = `"${column}" ${operator}`;
    } else {
      condition = `"${column}" ${operator} ?`;
      params.push(value);
    }
    conditions.push(condition);

    ({ addMore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addMore',
        message: t('ui.multiRow.addMoreConditions'),
        default: false,
      },
    ]));
  }

  return { whereClause: conditions.join(' AND '), params };
}

async function multiRowActionPrompt(db, table) {
  const { whereClause, params } = await buildWhereClause(db, table);

  if (!whereClause) {
    logger.warn(t('ui.multiRow.whereEmpty'));
    return;
  }

  try {
    const rows = searchRows(db, table, whereClause, params);
    if (rows.length === 0) {
      logger.warn(t('ui.multiRow.noRowsFound'));
      return;
    }

    logger.info(t('ui.multiRow.rowsFound', { count: rows.length }));
    console.table(rows);

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('ui.multiRow.actionPrompt'),
        choices: [
          {
            name: t('ui.multiRow.updateAll'),
            value: MULTI_ROW_ACTIONS.UPDATE,
          },
          {
            name: t('ui.multiRow.deleteAll'),
            value: MULTI_ROW_ACTIONS.DELETE,
          },
          new inquirer.Separator(),
          { name: t('common.back'), value: UI_ACTIONS.BACK },
        ],
      },
    ]);

    if (action === MULTI_ROW_ACTIONS.UPDATE) {
      await updateMultipleRows(db, table, whereClause, params, rows.length);
    } else if (action === MULTI_ROW_ACTIONS.DELETE) {
      await deleteMultipleRows(db, table, whereClause, params, rows.length);
    }
  } catch (err) {
    logger.error(t('actions.customQueryError', { message: err.message }));
  }
}

export async function tableActionPrompt(db, table) {
  let currentTable = table;
  displaySchema(db, currentTable);

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('ui.tableAction', { table: currentTable }),
        choices: [
          { name: t('ui.selectRowAction'), value: UI_ACTIONS.ROW_SELECT },
          { name: t('ui.multiRowAction'), value: UI_ACTIONS.ROW_MULTI_ACTION },
          { name: t('ui.insertRowAction'), value: UI_ACTIONS.ROW_INSERT },
          { name: t('ui.alterTableAction'), value: UI_ACTIONS.TABLE_ALTER },
          { name: t('ui.showSchemaAction'), value: UI_ACTIONS.TABLE_SCHEMA },
          new inquirer.Separator(),
          { name: t('ui.selectAnotherTable'), value: UI_ACTIONS.BACK },
        ],
      },
    ]);

    if (action === UI_ACTIONS.ROW_SELECT) {
      const { idKey, row } = await selectRow(db, currentTable);
      if (row && idKey) {
        await rowActionPrompt(db, currentTable, idKey, row);
      }
    } else if (action === UI_ACTIONS.ROW_MULTI_ACTION) {
      await multiRowActionPrompt(db, currentTable);
    } else if (action === UI_ACTIONS.ROW_INSERT) {
      await insertRow(db, currentTable);
    } else if (action === UI_ACTIONS.TABLE_ALTER) {
      currentTable = await alterTablePrompt(db, currentTable);
    } else if (action === UI_ACTIONS.TABLE_SCHEMA) {
      displaySchema(db, currentTable);
    } else if (action === UI_ACTIONS.BACK) {
      return;
    }
  }
}
