import { describe, it, expect } from 'vitest';
import {
  parseValueBasedOnOriginal,
  parseValueBasedOnSchema,
  isValidIdentifier,
} from '../utils.js';

describe('parseValueBasedOnOriginal', () => {
  it('should return null for "null" string', () => {
    expect(parseValueBasedOnOriginal('null', '')).toBeNull();
  });

  it('should return a number for a string number if original is a number', () => {
    expect(parseValueBasedOnOriginal('123', 0)).toBe(123);
  });

  it('should return undefined for an invalid number string if original is a number', () => {
    expect(parseValueBasedOnOriginal('abc', 0)).toBeUndefined();
  });

  it('should return a BigInt for a string number if original is a bigint', () => {
    expect(parseValueBasedOnOriginal('123', BigInt(0))).toBe(BigInt(123));
  });

  it('should return the original string for other cases', () => {
    expect(parseValueBasedOnOriginal('hello', 'world')).toBe('hello');
  });

  it('should return an empty string if input is empty and original is not null', () => {
    expect(parseValueBasedOnOriginal('', 'world')).toBe('');
  });
});

describe('parseValueBasedOnSchema', () => {
  it('should return null for "null" string', () => {
    expect(parseValueBasedOnSchema('null', 'TEXT')).toBeNull();
  });

  it('should return null for an empty string', () => {
    expect(parseValueBasedOnSchema('', 'TEXT')).toBeNull();
  });

  it('should return a number for an INT type', () => {
    expect(parseValueBasedOnSchema('42', 'INTEGER')).toBe(42);
  });

  it('should return a number for a REAL type', () => {
    expect(parseValueBasedOnSchema('3.14', 'REAL')).toBe(3.14);
  });

  it('should return undefined for an invalid number for INT type', () => {
    expect(parseValueBasedOnSchema('abc', 'INTEGER')).toBeUndefined();
  });

  it('should return the original string for a TEXT type', () => {
    expect(parseValueBasedOnSchema('hello world', 'TEXT')).toBe('hello world');
  });
});

describe('isValidIdentifier', () => {
  it('should return true for valid identifiers', () => {
    expect(isValidIdentifier('my_table')).toBe(true);
    expect(isValidIdentifier('column1')).toBe(true);
    expect(isValidIdentifier('my-table')).toBe(true);
    expect(isValidIdentifier('my table')).toBe(true);
    expect(isValidIdentifier('version1.2')).toBe(true);
    expect(isValidIdentifier('users_v2')).toBe(true);
  });

  it('should return false for invalid identifiers', () => {
    expect(isValidIdentifier('')).toBe(false);
    expect(isValidIdentifier(' ')).toBe(false);
    expect(isValidIdentifier('my"table')).toBe(false);
    expect(isValidIdentifier('my`table')).toBe(false);
    expect(isValidIdentifier("my'table")).toBe(false);
    expect(isValidIdentifier('my/table')).toBe(false);
    expect(isValidIdentifier(null)).toBe(false);
    expect(isValidIdentifier(undefined)).toBe(false);
  });
});
