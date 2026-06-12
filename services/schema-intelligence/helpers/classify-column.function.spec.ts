import { FieldCategory } from '../types/field-category.enum';
import { classifyColumn } from './classify-column.function';

describe('classifyColumn', () => {
  it('classifies binary types', () => {
    expect(classifyColumn('blob')).toBe(FieldCategory.BINARY);
    expect(classifyColumn('mediumblob')).toBe(FieldCategory.BINARY);
    expect(classifyColumn('binary')).toBe(FieldCategory.BINARY);
    expect(classifyColumn('varbinary')).toBe(FieldCategory.BINARY);
  });

  it('classifies json types', () => {
    expect(classifyColumn('json')).toBe(FieldCategory.JSON);
  });

  it('classifies text types', () => {
    expect(classifyColumn('text')).toBe(FieldCategory.TEXT);
    expect(classifyColumn('mediumtext')).toBe(FieldCategory.TEXT);
    expect(classifyColumn('longtext')).toBe(FieldCategory.TEXT);
    expect(classifyColumn('tinytext')).toBe(FieldCategory.TEXT);
  });

  it('classifies common scalar types', () => {
    expect(classifyColumn('int')).toBe(FieldCategory.SCALAR);
    expect(classifyColumn('varchar')).toBe(FieldCategory.SCALAR);
    expect(classifyColumn('datetime')).toBe(FieldCategory.SCALAR);
    expect(classifyColumn('decimal')).toBe(FieldCategory.SCALAR);
  });
});
