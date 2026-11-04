nextflow.enable.dsl = 2

// No aligner is selected here. The configured adapter must produce SAM with
// sample-name read-group metadata and own its approved index/tool strategy.
process QC {
    cpus params.threads
    input:
    path reads, stageAs: 'input.fastq'
    output:
    path 'clean.fastq', emit: reads
    path 'fastp.json', emit: qc
    script:
    """
    "${params.fastp_executable}" -i input.fastq -o clean.fastq -j fastp.json -h fastp.html -w ${task.cpus}
    """
}

process ALIGN {
    cpus params.threads
    input:
    path reads, stageAs: 'clean.fastq'
    path reference, stageAs: 'reference.fa'
    output:
    path 'aligned.sam'
    script:
    """
    "${params.alignment_adapter}" --reads clean.fastq --reference reference.fa --output aligned.sam --sample-name "${params.sample_name}" --threads ${task.cpus}
    test -s aligned.sam
    """
}

process BAM {
    cpus params.threads
    input:
    path sam, stageAs: 'aligned.sam'
    output:
    tuple path('sorted.bam'), path('sorted.bam.bai')
    script:
    """
    "${params.samtools_executable}" sort -@ ${task.cpus} -o sorted.bam aligned.sam
    "${params.samtools_executable}" index sorted.bam
    """
}

process CALL {
    cpus params.threads
    publishDir params.outdir, mode: 'copy', overwrite: false
    input:
    tuple path(bam), path(bai)
    path reference, stageAs: 'reference.fa'
    output:
    path 'result.vcf'
    script:
    """
    "${params.samtools_executable}" faidx reference.fa
    "${params.bcftools_executable}" mpileup -a FORMAT/DP -Ou -f reference.fa ${bam} | "${params.bcftools_executable}" call --ploidy ${params.ploidy} -mv -Ov -o result.vcf
    """
}

process PUBLISH_QC {
    publishDir params.outdir, mode: 'copy', overwrite: false
    input:
    path qc, stageAs: 'qc-input.json'
    output:
    path 'fastp.json'
    script:
    """
    cp qc-input.json fastp.json
    """
}

workflow {
    if (!params.alignment_adapter || !params.alignment_strategy || !params.sample_name)
        error 'An operator-configured alignment adapter, strategy identifier, and sample mapping are required'
    if (!params.ploidy || params.ploidy < 1 || !params.fastp_executable || !params.samtools_executable || !params.bcftools_executable)
        error 'Explicit caller ploidy and downstream executables are required'
    reads = Channel.value(file(params.reads, checkIfExists: true))
    reference = Channel.value(file(params.reference, checkIfExists: true))
    QC(reads)
    ALIGN(QC.out.reads, reference)
    BAM(ALIGN.out)
    CALL(BAM.out, reference)
    PUBLISH_QC(QC.out.qc)
}
