import { FieldCategory } from '../types/field-category.enum';

const BINARY_DATA_TYPES = new Set([
  'binary',
  'varbinary',
  'blob',
  'tinyblob',
  'mediumblob',
  'longblob',
]);

const TEXT_DATA_TYPES = new Set(['tinytext', 'text', 'mediumtext', 'longtext']);

export function classifyColumn(dataType: string): FieldCategory {
  const t = dataType.toLowerCase();

  if (BINARY_DATA_TYPES.has(t)) {
    return FieldCategory.BINARY;
  }

  if (t === 'json') {
    return FieldCategory.JSON;
  }

  if (TEXT_DATA_TYPES.has(t)) {
    return FieldCategory.TEXT;
  }

  return FieldCategory.SCALAR;
}
