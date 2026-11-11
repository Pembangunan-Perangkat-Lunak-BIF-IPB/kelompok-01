// Normalize punctuation only in displayed reference labels; preserve API/scientific data.
export function displayReferenceName(name: string): string {
  return name.replace(/[\u2013\u2014]/g, '-');
}
