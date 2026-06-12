import { FieldCategory } from '../types/field-category.enum';
import { SelectRisk } from '../types/schema.types';

export const RISKY_CHAR_MAX_LENGTH = 500;

export function classifySelectRisk(
  category: FieldCategory,
  maxLength: number | null,
): SelectRisk {
  if (
    category === FieldCategory.BINARY ||
    category === FieldCategory.TEXT ||
    category === FieldCategory.JSON
  ) {
    return 'risky';
  }

  if (maxLength !== null && maxLength > RISKY_CHAR_MAX_LENGTH) {
    return 'risky';
  }

  return 'safe';
}
