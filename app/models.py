from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "user"
    __table_args__ = (UniqueConstraint("username", name="uq_user_username"),)

    id_user = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    nama = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)

    samples = relationship("Sample", back_populates="owner")
    jobs = relationship("Job", back_populates="owner")


class ReferenceGenome(Base):
    __tablename__ = "reference_genome"

    id_reference_genome = Column(Integer, primary_key=True, index=True)
    nama_genom = Column(String, nullable=False)
    versi = Column(String)
    sumber = Column(String)
    path_fasta = Column(String, nullable=False)

    jobs = relationship("Job", back_populates="reference_genome")


class Sample(Base):
    __tablename__ = "sample"

    id_sample = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("user.id_user"), nullable=False)
    nama_berkas = Column(String, nullable=False)
    path_penyimpanan = Column(String, nullable=False)
    ukuran_berkas = Column(BigInteger, nullable=False)
    waktu_unggah = Column(DateTime, nullable=False)

    owner = relationship("User", back_populates="samples")
    jobs = relationship("Job", back_populates="sample")
    genotypes = relationship("Genotype", back_populates="sample")


class Job(Base):
    __tablename__ = "job"

    id_job = Column(Integer, primary_key=True)
    id_user = Column(Integer, ForeignKey("user.id_user"), nullable=False)
    id_sample = Column(Integer, ForeignKey("sample.id_sample"), nullable=False)
    id_reference_genome = Column(
        Integer, ForeignKey("reference_genome.id_reference_genome"), nullable=False
    )
    status = Column(String, nullable=False)
    waktu_mulai = Column(DateTime, nullable=True)
    waktu_selesai = Column(DateTime, nullable=True)
    pesan_error = Column(Text, nullable=True)

    owner = relationship("User", back_populates="jobs")
    sample = relationship("Sample", back_populates="jobs")
    reference_genome = relationship("ReferenceGenome", back_populates="jobs")
    analysis = relationship("Analysis", back_populates="job", uselist=False)


class Analysis(Base):
    __tablename__ = "analysis"
    __table_args__ = (UniqueConstraint("id_job", name="uq_analysis_id_job"),)

    id_analysis = Column(Integer, primary_key=True)
    id_job = Column(Integer, ForeignKey("job.id_job"), nullable=False)
    parameter_qual = Column(Float, nullable=False)
    parameter_dp = Column(Integer, nullable=False)
    metrik_qc = Column(String, nullable=True)
    total_varian = Column(Integer, nullable=True)
    snp_count = Column(Integer, nullable=True)
    indel_count = Column(Integer, nullable=True)
    path_vcf = Column(String, nullable=True)
    path_csv = Column(String, nullable=True)

    job = relationship("Job", back_populates="analysis")
    variants = relationship("Variant", back_populates="analysis")


class Variant(Base):
    __tablename__ = "variant"

    id_variant = Column(Integer, primary_key=True)
    id_analysis = Column(Integer, ForeignKey("analysis.id_analysis"), nullable=False)
    chromosome = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    ref_allele = Column(String, nullable=False)
    alt_allele = Column(String, nullable=False)
    qual = Column(Float, nullable=True)

    analysis = relationship("Analysis", back_populates="variants")
    genotypes = relationship("Genotype", back_populates="variant")


class Genotype(Base):
    __tablename__ = "genotype"

    id_genotype = Column(Integer, primary_key=True)
    id_variant = Column(Integer, ForeignKey("variant.id_variant"), nullable=False)
    id_sample = Column(Integer, ForeignKey("sample.id_sample"), nullable=False)
    genotype_call = Column(String, nullable=False)
    dp = Column(Integer, nullable=True)

    variant = relationship("Variant", back_populates="genotypes")
    sample = relationship("Sample", back_populates="genotypes")
