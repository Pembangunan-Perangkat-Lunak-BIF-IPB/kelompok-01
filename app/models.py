from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "user"

    id_user = Column(Integer, primary_key=True, index=True)
    nama = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    
    samples = relationship("Sample", back_populates="owner")

class ReferenceGenome(Base):
    __tablename__ = "reference_genome"

    id_reference_genome = Column(Integer, primary_key=True, index=True)
    nama_genom = Column(String, nullable=False)
    versi = Column(String)
    sumber = Column(String)
    path_fasta = Column(String, nullable=False)

class Sample(Base):
    __tablename__ = "sample"

    id_sample = Column(Integer, primary_key=True, index=True)
    id_user = Column(Integer, ForeignKey("user.id_user"), nullable=False)
    nama_berkas = Column(String, nullable=False)
    path_penyimpanan = Column(String, nullable=False)
    ukuran_berkas = Column(BigInteger, nullable=False)
    waktu_unggah = Column(DateTime, nullable=False)
    
    owner = relationship("User", back_populates="samples")