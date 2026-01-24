import chalk from 'chalk';

export function parseValueBasedOnOriginal(inputValue, originalValue) {
  if (inputValue.toLowerCase() === 'null') return null;
  if (inputValue === '' && originalValue !== null) return '';

  const originalType = typeof originalValue;

  if (originalType === 'number') {
    const num = Number(inputValue);
    return isNaN(num) ? undefined : num;
  }

  if (originalType === 'bigint') {
    try {
      return BigInt(inputValue);
    } catch (e) {
      return undefined;
    }
  }

  return inputValue;
}

export function parseValueBasedOnSchema(inputValue, schemaType) {
  const upperType = schemaType.toUpperCase();
  if (inputValue.toLowerCase() === 'null') return null;
  if (inputValue === '') return null;

  if (upperType.includes('INT')) {
    try {
      const num = Number(inputValue);
      return isNaN(num) ? undefined : num;
    } catch (e) {
      return undefined;
    }
  }
  if (
    upperType.includes('REAL') ||
    upperType.includes('FLOAT') ||
    upperType.includes('DOUB')
  ) {
    const num = Number(inputValue);
    return isNaN(num) ? undefined : num;
  }

  return inputValue;
}

export function isValidIdentifier(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  return /^[A-Za-z0-9_\s.-]*[A-Za-z0-9_-]+[A-Za-z0-9_\s.-]*$/.test(name);
}

export const logger = {
  info: (message) => console.log(chalk.blue(message)),
  success: (message) => console.log(chalk.green(message)),
  warn: (message) => console.log(chalk.yellow(message)),
  error: (message) => console.error(chalk.red(message)),
  log: (message) => console.log(message),
};
