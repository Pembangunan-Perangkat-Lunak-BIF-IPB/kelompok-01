"""Public Result Viewer DTOs. No storage paths or arbitrary execution metadata."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class VariantFilters(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    variant_type: Literal["snp", "indel", "other", "unclassified"] | None = None
    min_qual: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    max_qual: float | None = Field(default=None, ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def ordered_quality_bounds(self):
        if self.min_qual is not None and self.max_qual is not None and self.min_qual > self.max_qual:
            raise ValueError("min_qual must not exceed max_qual")
        return self


class VariantQuery(VariantFilters):
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0, le=2**31 - 1)


class VariantCounts(BaseModel):
    total_variants: int = Field(ge=0)
    snps: int = Field(ge=0)
    indels: int = Field(ge=0)
    other: int = Field(ge=0)
    unclassified: int = Field(ge=0, description="Legacy NULL/unknown type, never relabeled as other.")


class ResultParameters(BaseModel):
    parameter_qual: float
    parameter_dp: int
    require_pass: bool | None
    variant_ploidy: int | None


class ResultSummary(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [
        {'id_job': 11,
         'id_analysis': 11,
         'id_sample': 3,
         'id_reference_genome': 3,
         'status': 'Completed',
         'counts': {'total_variants': 3, 'snps': 1, 'indels': 1, 'other': 1, 'unclassified': 0},
         'parameters': {'parameter_qual': 30.0,
                        'parameter_dp': 10,
                        'require_pass': True,
                        'variant_ploidy': 2},
         'execution_mode': 'synthetic',
         'waktu_mulai': '2026-11-03T11:39:46.265060Z',
         'waktu_selesai': '2026-11-03T11:39:46.391799Z'}
    ]})

    id_job: int
    id_analysis: int
    id_sample: int
    id_reference_genome: int
    status: Literal["Completed"]
    counts: VariantCounts
    parameters: ResultParameters
    execution_mode: Literal["synthetic", "nextflow"] | None
    waktu_mulai: datetime | None
    waktu_selesai: datetime | None


class GenotypeResult(BaseModel):
    id_genotype: int
    id_sample: int
    genotype_call: str
    dp: int | None


class VariantResult(BaseModel):
    id_variant: int
    chromosome: str
    position: int
    ref_allele: str
    alt_allele: str
    qual: float | None
    variant_type: str | None
    filter_status: str | None
    info: dict[str, str | None] | None
    genotypes: list[GenotypeResult]


class VariantPage(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [
        {'id_job': 11,
         'id_analysis': 11,
         'items': [{'id_variant': 419,
                    'chromosome': 'synthetic_chr',
                    'position': 3,
                    'ref_allele': 'A',
                    'alt_allele': 'C,AT',
                    'qual': 60.0,
                    'variant_type': 'other',
                    'filter_status': 'PASS',
                    'info': {'DP': '999'},
                    'genotypes': [{'id_genotype': 419,
                                   'id_sample': 3,
                                   'genotype_call': '0/1',
                                   'dp': 25}]}],
         'total': 3,
         'limit': 1,
         'offset': 2,
         'returned': 1,
         'has_more': False,
         'next_offset': None,
         'filters': {'variant_type': None, 'min_qual': 60.0, 'max_qual': None}}
    ]})

    id_job: int
    id_analysis: int
    items: list[VariantResult]
    total: int = Field(ge=0, description="Variant count AFTER filters, before limit/offset.")
    limit: int
    offset: int
    returned: int
    has_more: bool
    next_offset: int | None
    filters: VariantFilters
