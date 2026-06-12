const TEXT_MAX_LENGTH_BY_DATA_TYPE: Record<string, number> = {
  tinytext: 255,
  text: 65_535,
  mediumtext: 16_777_215,
  longtext: 4_294_967_295,
};

export function effectiveCharMaxLength(
  dataType: string,
  charMaxLength: number | null,
): number | null {
  if (charMaxLength !== null) {
    return charMaxLength;
  }

  return TEXT_MAX_LENGTH_BY_DATA_TYPE[dataType.toLowerCase()] ?? null;
}
