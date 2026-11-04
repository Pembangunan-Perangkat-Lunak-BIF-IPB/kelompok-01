nextflow.enable.dsl = 2

// Explicit single-end execution. Bowtie2 indexes are precomputed operator inputs.
process QC {
    cpus params.threads
    input:
    path reads, stageAs: 'source'
    val gzip_input
    output:
    path 'clean.fastq', emit: reads
    path 'fastp.json', emit: qc
    script:
    """
    ln -s source ${gzip_input ? "input.fastq.gz" : "input.fastq"}
    "${params.fastp_executable}" -i ${gzip_input ? "input.fastq.gz" : "input.fastq"} -o clean.fastq -j fastp.json -h fastp.html -w ${task.cpus}
    """
}

process ALIGN {
    cpus params.threads
    input:
    path reads, stageAs: 'clean.fastq'
    path reference, stageAs: 'reference.fa'
    path indexes, stageAs: 'index/*'
    output:
    path 'aligned.sam'
    script:
    def indexName = params.bowtie2_index_prefix ? file(params.bowtie2_index_prefix).name : ''
    def bowtieArgs = params.alignment_strategy == 'bowtie2' ? """--index-prefix "index/${indexName}" --bowtie2 "${params.bowtie2_executable}" --bowtie2-inspect "${params.bowtie2_inspect_executable}" """ : ''
    """
    "${params.alignment_adapter}" --reads clean.fastq --reference reference.fa --output aligned.sam --sample-name "${params.sample_name}" --threads ${task.cpus} ${bowtieArgs}
    test -s aligned.sam
    """
}

process BAM {
    cpus params.threads
    publishDir params.outdir, mode: 'copy', overwrite: false
    input:
    path sam, stageAs: 'aligned.sam'
    output:
    tuple path('sorted.bam'), path('sorted.bam.csi')
    script:
    """
    "${params.samtools_executable}" sort -@ ${task.cpus} -m 256M -o sorted.bam aligned.sam
    "${params.samtools_executable}" quickcheck -v sorted.bam
    "${params.samtools_executable}" index -c sorted.bam
    """
}

process CALL {
    cpus params.threads
    publishDir params.outdir, mode: 'copy', overwrite: false
    input:
    tuple path(bam), path(bam_index)
    path reference, stageAs: 'reference.fa'
    output:
    path 'result.vcf'
    path 'raw.vcf'
    script:
    """
    "${params.samtools_executable}" faidx reference.fa
    "${params.bcftools_executable}" mpileup -a FORMAT/DP -Ou -f reference.fa ${bam} | "${params.bcftools_executable}" call --ploidy ${params.ploidy} -mv -Ov -o raw.vcf
    "${params.bcftools_executable}" filter -s LowQualOrDepth -e 'QUAL="." || FMT/DP="." || QUAL < ${params.minimum_qual} || FMT/DP < ${params.minimum_dp}' -Ov -o result.vcf raw.vcf
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
    if (!(params.ploidy in [1, 2]) || !params.fastp_executable || !params.samtools_executable || !params.bcftools_executable)
        error 'Explicit caller ploidy and downstream executables are required'
    if (!(params.threads in 1..4) || params.minimum_qual == null || params.minimum_dp == null)
        error 'Explicit filtering thresholds and one to four threads are required'
    def indexes = []
    if (params.alignment_strategy == 'bowtie2') {
        if (!params.bowtie2_index_prefix || !params.bowtie2_executable || !params.bowtie2_inspect_executable)
            error 'Explicit Bowtie2 executables and precomputed index prefix are required'
        def extension = file("${params.bowtie2_index_prefix}.1.bt2").exists() ? 'bt2' : 'bt2l'
        indexes = ['1', '2', '3', '4', 'rev.1', 'rev.2'].collect {
            file("${params.bowtie2_index_prefix}.${it}.${extension}", checkIfExists: true)
        }
    }
    reads = Channel.value(file(params.reads, checkIfExists: true))
    reference = Channel.value(file(params.reference, checkIfExists: true))
    QC(reads, params.reads.toString().endsWith('.gz'))
    ALIGN(QC.out.reads, reference, Channel.value(indexes))
    BAM(ALIGN.out)
    CALL(BAM.out, reference)
    PUBLISH_QC(QC.out.qc)
}
