import { FieldCategory } from '../types/field-category.enum';
import { classifySelectRisk, RISKY_CHAR_MAX_LENGTH } from './classify-select-risk';

describe('classifySelectRisk', () => {
  it('marks binary, text, and json as risky', () => {
    expect(classifySelectRisk(FieldCategory.BINARY, null)).toBe('risky');
    expect(classifySelectRisk(FieldCategory.TEXT, null)).toBe('risky');
    expect(classifySelectRisk(FieldCategory.JSON, null)).toBe('risky');
  });

  it('marks large varchar as risky', () => {
    expect(classifySelectRisk(FieldCategory.SCALAR, RISKY_CHAR_MAX_LENGTH)).toBe(
      'safe',
    );
    expect(
      classifySelectRisk(FieldCategory.SCALAR, RISKY_CHAR_MAX_LENGTH + 1),
    ).toBe('risky');
  });

  it('marks small scalar fields as safe', () => {
    expect(classifySelectRisk(FieldCategory.SCALAR, 50)).toBe('safe');
    expect(classifySelectRisk(FieldCategory.SCALAR, null)).toBe('safe');
  });
});
