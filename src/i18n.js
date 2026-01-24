import fs from 'fs/promises';
import path from 'path';

let translations = {};
let currentLang = 'en';

function resolve(path, obj) {
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : null;
  }, obj || self);
}

export async function init(language) {
  let lang = language;

  if (!lang) {
    const envLang = process.env.LANG || 'en_US.UTF-8';
    lang = envLang.split('.')[0].split('_')[0];
  }

  if (!['en', 'ja'].includes(lang)) {
    lang = 'en';
  }

  currentLang = lang;

  try {
    const filePath = path.resolve(process.cwd(), `locales/${currentLang}.json`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    translations = JSON.parse(fileContent);
  } catch (error) {
    console.error(
      `Could not load translations for '${currentLang}'. Falling back to English.`
    );
    currentLang = 'en';
    const filePath = path.resolve(process.cwd(), `locales/en.json`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    translations = JSON.parse(fileContent);
  }
}

export function t(key, replacements = {}) {
  let translation = resolve(key, translations);

  if (!translation) {
    console.warn(`Translation not found for key: ${key}`);
    return key;
  }

  for (const placeholder in replacements) {
    translation = translation.replace(
      new RegExp(`{${placeholder}}`, 'g'),
      replacements[placeholder]
    );
  }

  return translation;
}

export function getLang() {
  return currentLang;
}
