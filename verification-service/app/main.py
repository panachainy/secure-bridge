"""Main FastAPI application for verification service."""

import logging

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.crypto_service import CryptoService
from app.database import get_db, init_db
from app.repository import VerificationRepository
from app.schemas import (IngressPayload, IngressResponse, PublicKeyResponse,
                         SearchRequest, SearchResponse)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Verification Service",
    description="Secure verification service with hybrid encryption and blind indexing",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize crypto service
crypto_service = CryptoService(
    private_key_path=settings.private_key_path,
    hmac_secret=settings.hmac_secret_key,
    storage_key=settings.storage_encryption_key,
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully")


@app.get("/")
async def healthcheck():
    """Health check endpoint."""
    return {"status": "ok", "service": "verification-service"}


@app.get(f"{settings.api_prefix}/public-key", response_model=PublicKeyResponse)
async def get_public_key():
    """Get the RSA public key for client encryption.

    Returns:
        Public key in PEM format
    """
    return PublicKeyResponse(
        public_key=crypto_service.get_public_key_pem(), format="PEM"
    )


@app.post(f"{settings.api_prefix}/ingress", response_model=IngressResponse)
async def secure_ingress(payload: IngressPayload, db: Session = Depends(get_db)):
    """Secure ingress endpoint - Accept and decrypt encrypted payload.

    This endpoint:
    1. Accepts encrypted payload from the client library
    2. Decrypts the symmetric key using RSA private key
    3. Decrypts the data using the symmetric key
    4. Stores data with blind indexing:
       - Column A: Randomized encryption for storage
       - Column B: HMAC-SHA256 for deterministic search index

    Args:
        payload: Encrypted payload containing symmetric key and data
        db: Database session

    Returns:
        Response with success status and record ID
    """
    try:
        # Step 1: Decrypt the payload using hybrid encryption
        logger.info("Decrypting incoming payload...")
        decrypted_data = crypto_service.decrypt_payload(
            encrypted_symmetric_key=payload.encrypted_symmetric_key,
            encrypted_data=payload.encrypted_data,
        )

        logger.info(
            f"Successfully decrypted data for National ID: {decrypted_data.get('national_id', 'N/A')}"
        )

        # Step 2: Validate decrypted data
        if not decrypted_data.get("national_id") or not decrypted_data.get("name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: national_id and name",
            )

        # Step 3: Store with blind indexing
        repo = VerificationRepository(db, crypto_service)

        try:
            record_id = repo.create_record(
                national_id=decrypted_data["national_id"],
                name=decrypted_data["name"],
                additional_data=decrypted_data.get("additional_data"),
            )

            logger.info(f"Record created successfully with ID: {record_id}")

            return IngressResponse(
                success=True,
                message="Data received and stored securely",
                record_id=record_id,
            )

        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing ingress: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process payload: {str(e)}",
        )


@app.post(f"{settings.api_prefix}/search", response_model=SearchResponse)
async def search_by_national_id(
    search_request: SearchRequest, db: Session = Depends(get_db)
):
    """Search endpoint - Query by National ID using blind index.

    This endpoint:
    1. Creates a blind index (HMAC-SHA256) from the search query
    2. Searches the database using the deterministic index (exact match)
    3. Decrypts and returns the matching record if found

    Args:
        search_request: Search request containing National ID
        db: Database session

    Returns:
        Search results with decrypted data
    """
    try:
        logger.info(f"Searching for National ID: {search_request.national_id}")

        repo = VerificationRepository(db, crypto_service)
        result = repo.search_by_national_id(search_request.national_id)

        if result:
            logger.info("Record found and decrypted")
            return SearchResponse(
                found=True,
                national_id=result["national_id"],
                name=result["name"],
                additional_data=result.get("additional_data"),
                created_at=result["created_at"],
            )
        else:
            logger.info("No record found")
            return SearchResponse(found=False)

    except Exception as e:
        logger.error(f"Error during search: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}",
        )


@app.get(f"{settings.api_prefix}/records")
async def get_all_records(db: Session = Depends(get_db)):
    """Get all records (for testing/admin purposes).

    WARNING: This endpoint should be protected or removed in production.

    Args:
        db: Database session

    Returns:
        List of all decrypted records
    """
    try:
        repo = VerificationRepository(db, crypto_service)
        records = repo.get_all_records()
        return {"records": records, "count": len(records)}
    except Exception as e:
        logger.error(f"Error retrieving records: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve records: {str(e)}",
        )
