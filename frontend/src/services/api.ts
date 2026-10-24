import type { JobItem } from '../pages/JobMonitoringPage';

export async function fetchJobStatuses(token?: string): Promise<JobItem[]> {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/jobs/status', { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    return await res.json();
  } catch {
    // Fallback Mock Data yang disesuaikan dengan interface JobItem baru
    return [
      {
        id: '#JOB-0941',
        sampleName: 'Bawang_Putih_Lokal_Tawangmangu_R1.fq',
        fastqType: 'Single-End',
        status: 'Running',
        statusLabel: 'Berjalan: Alignment BWA-MEM2',
      },
      {
        id: '#JOB-0938',
        sampleName: 'Allium_sativum_Cianjur_SE.fastq.gz',
        fastqType: 'Single-End',
        status: 'Completed',
        statusLabel: 'Selesai',
        vcfReportId: 'JOB-0938',
      },
      {
        id: '#JOB-0925',
        sampleName: 'Garlic_Brebes_Kultivar_Lumbu_Hijau.fq',
        fastqType: 'Paired-End',
        status: 'Completed',
        statusLabel: 'Selesai',
        vcfReportId: 'JOB-0925',
      },
      {
        id: '#JOB-0919',
        sampleName: 'Sampel_Uji_Coba_Corrupt_Read.fastq',
        fastqType: 'Single-End',
        status: 'Failed',
        statusLabel: 'Gagal: FASTQ Korup',
      },
      {
        id: '#JOB-0910',
        sampleName: 'Allium_sativum_Kupang_Isolat_03.fastq',
        fastqType: 'Single-End',
        status: 'Completed',
        statusLabel: 'Selesai',
        vcfReportId: 'JOB-0910',
      },
    ];
  }
}