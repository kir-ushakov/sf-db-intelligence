import { effectiveCharMaxLength } from './effective-char-max-length.function';

describe('effectiveCharMaxLength', () => {
  it('returns CHARACTER_MAXIMUM_LENGTH when present', () => {
    expect(effectiveCharMaxLength('varchar', 255)).toBe(255);
    expect(effectiveCharMaxLength('varchar', 2000)).toBe(2000);
  });

  it('derives max length for text types when CHARACTER_MAXIMUM_LENGTH is null', () => {
    expect(effectiveCharMaxLength('tinytext', null)).toBe(255);
    expect(effectiveCharMaxLength('text', null)).toBe(65_535);
    expect(effectiveCharMaxLength('mediumtext', null)).toBe(16_777_215);
    expect(effectiveCharMaxLength('longtext', null)).toBe(4_294_967_295);
  });

  it('returns null for non-character types', () => {
    expect(effectiveCharMaxLength('int', null)).toBeNull();
    expect(effectiveCharMaxLength('datetime', null)).toBeNull();
  });
});
