import type { SubmissionParameters } from './api';

export interface SubmissionDraft {
  parameters: SubmissionParameters;
  file: { name: string; size: number; lastModified: number };
  reconciliation: boolean;
}
const key = (username: string) => 'genopath:submission:' + username;
export function loadDraft(username: string): SubmissionDraft | null {
  const raw = sessionStorage.getItem(key(username));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SubmissionDraft;
    const p = data.parameters;
    if (!p || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.request_id) ||
        p.execution_mode !== 'nextflow' || p.alignment_strategy !== 'bowtie2' || p.require_pass !== true ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(p.vcf_sample) ||
        !Number.isSafeInteger(p.id_reference_genome) || p.id_reference_genome <= 0 || p.id_reference_genome > 2 ** 31 - 1 ||
        ![1, 2].includes(p.variant_ploidy) || !Number.isFinite(p.parameter_qual) || p.parameter_qual < 0 ||
        !Number.isInteger(p.parameter_dp) || p.parameter_dp < 0 || p.parameter_dp > 2 ** 31 - 1 ||
        !data.file?.name || !/\.fastq(?:\.gz)?$/.test(data.file.name) ||
        !Number.isSafeInteger(data.file.size) || data.file.size <= 0 ||
        !Number.isFinite(data.file.lastModified) || typeof data.reconciliation !== 'boolean') throw new Error('Invalid draft');
    return data;
  } catch {
    throw new Error('Catatan submission tidak dapat dibaca. Minta pemeriksaan operator sebelum mengunggah ulang.');
  }
}
export function saveDraft(username: string, draft: SubmissionDraft): void {
  sessionStorage.setItem(key(username), JSON.stringify(draft));
}
export function clearDraft(username: string): void { sessionStorage.removeItem(key(username)); }
export function matchesFile(draft: SubmissionDraft, file: File): boolean {
  return draft.file.name === file.name && draft.file.size === file.size && draft.file.lastModified === file.lastModified;
}
export function makeParameters(values: {
  reference: string; ploidy: string; qual: string; dp: string; filename: string;
}, requestId = crypto.randomUUID()): SubmissionParameters {
  const reference = Number(values.reference), ploidy = Number(values.ploidy);
  const qual = Number(values.qual), dp = Number(values.dp);
  if (!values.reference.trim() || !Number.isSafeInteger(reference) || reference <= 0 || reference > 2 ** 31 - 1 ||
      ![1, 2].includes(ploidy) || !values.qual.trim() || !Number.isFinite(qual) || qual < 0 ||
      !values.dp.trim() || !Number.isInteger(dp) || dp < 0 || dp > 2 ** 31 - 1) {
    throw new Error('Pilih reference dan ploidi; QUAL harus angka finite ≥ 0, DP harus integer 0–2147483647.');
  }
  const vcfSample = values.filename.replace(/\.fastq(?:\.gz)?$/, '').replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^[^A-Za-z0-9]+/, 's_').slice(0, 64) || 'sample';
  return { request_id: requestId, id_reference_genome: reference, vcf_sample: vcfSample,
    parameter_qual: qual, parameter_dp: dp, variant_ploidy: ploidy, require_pass: true,
    execution_mode: 'nextflow', alignment_strategy: 'bowtie2' };
}
