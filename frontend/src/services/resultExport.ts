import type { VariantItem } from './api';

function cell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  // Spreadsheet-safe strings; CSV quoting alone does not prevent formula execution.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function pageCsv(items: VariantItem[]): string {
  const headers = ['ID Varian', 'Kromosom', 'Posisi', 'REF', 'ALT', 'QUAL', 'DP', 'GT', 'FILTER', 'Tipe'];
  return [headers, ...items.map(item => [
    item.id_variant, item.chromosome, item.position, item.ref_allele, item.alt_allele, item.qual,
    item.genotypes.map(call => call.dp ?? '').join(';'), item.genotypes.map(call => call.genotype_call).join(';'),
    item.filter_status, item.variant_type,
  ])].map(row => row.map(cell).join(',')).join('\r\n');
}
