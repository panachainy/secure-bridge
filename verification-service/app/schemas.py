"""Pydantic schemas for request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# Entity schemas


class VerificationData(BaseModel):
    """Schema for decrypted verification data."""

    national_id: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    additional_data: Optional[dict] = None


# Request schemas


class IngressPayload(BaseModel):
    """Schema for encrypted payload from client library."""

    encrypted_symmetric_key: str = Field(
        ..., description="RSA-encrypted symmetric key (base64)"
    )
    encrypted_data: str = Field(..., description="AES-encrypted data (base64)")


class SearchRequest(BaseModel):
    """Request schema for search endpoint."""

    national_id: str = Field(
        ..., min_length=1, max_length=20, description="National ID to search for"
    )


# Response schemas


class IngressResponse(BaseModel):
    """Response from ingress endpoint."""

    success: bool
    message: str
    record_id: Optional[str] = None


class PublicKeyResponse(BaseModel):
    """Response containing the public key."""

    public_key: str
    format: str = "PEM"


class SearchResponse(BaseModel):
    """Response schema for search endpoint."""

    found: bool
    national_id: Optional[str] = None
    name: Optional[str] = None
    additional_data: Optional[dict] = None
    created_at: Optional[datetime] = None


__all__ = [
    # Entity schemas
    "VerificationData",
    # Request schemas
    "IngressPayload",
    "SearchRequest",
    # Response schemas
    "IngressResponse",
    "PublicKeyResponse",
    "SearchResponse",
]
