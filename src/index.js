import { selectDatabase, closeDatabase } from './db.js';
import { selectTable, tableActionPrompt } from './ui.js';
import { createTable, executeCustomQueryAction } from './actions.js';
import { logger } from './utils.js';
import { init, getLang, t } from './i18n.js';
import { CHOICES } from './constants.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const meta = await getMetaData();

async function displayHelp() {
  try {
    const lang = getLang();
    const helpMessagePath = path.resolve(
      __dirname,
      `../assets/help_message_${lang}.txt`
    );

    const helpContent = await fs.readFile(helpMessagePath, 'utf-8');

    const rendered = helpContent
      .replace(/\$\{meta\.version\}/g, meta.version ?? '')
      .replace(/\$\{meta\.repositoryURL\}/g, meta.repository.url ?? '');

    console.log(rendered);
  } catch (error) {
    logger.error(t('common.error'), error.message);
  }
}

async function getMetaData() {
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
  return JSON.parse(packageJsonContent);
}

export async function main() {
  const args = hideBin(process.argv);

  const langArg = yargs(args.filter((a) => a !== '-h' && a !== '--help'))
    .option('lang', { alias: 'l', type: 'string', choices: ['en', 'ja'] })
    .help(false)
    .version(false)
    .parseSync();
  await init(langArg.lang || null);

  if (args.includes('-h') || args.includes('--help')) {
    await displayHelp();
    return;
  }

  const argv = yargs(args)
    .version(meta.version)
    .alias('v', 'version')
    .positional('dbPath', {
      describe: t('common.dbpath_description'),
      type: 'string',
    })
    .help(false)
    .parse();

  let db;
  try {
    db = await selectDatabase(argv.dbPath);
    if (!db) return;

    while (true) {
      const table = await selectTable(db);

      if (table === CHOICES.TABLE_NEW) {
        await createTable(db);
      } else if (table === CHOICES.TABLE_CUSTOM_QUERY) {
        await executeCustomQueryAction(db);
      } else if (table) {
        await tableActionPrompt(db, table);
      } else {
        break;
      }
    }
  } catch (err) {
    logger.error(`\n${t('common.error')}:`, err.message);
    process.exit(1);
  } finally {
    if (db) {
      closeDatabase(db);
    }
  }
}
