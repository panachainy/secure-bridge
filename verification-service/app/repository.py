"""Repository layer for database operations."""

import json
import uuid
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crypto_service import CryptoService
from app.database import VerificationRecord


class VerificationRepository:
    """Repository for verification record operations."""

    def __init__(self, db: Session, crypto_service: CryptoService):
        """Initialize repository.

        Args:
            db: Database session
            crypto_service: Crypto service for encryption
        """
        self.db = db
        self.crypto = crypto_service

    def create_record(
        self, national_id: str, name: str, additional_data: Optional[dict] = None
    ) -> str:
        """Create a new verification record with blind indexing.

        Args:
            national_id: National ID number
            name: Person's name
            additional_data: Additional JSON data

        Returns:
            Record ID

        Raises:
            ValueError: If record already exists
        """
        record_id = str(uuid.uuid4())

        # Column A: Randomized encryption (different ciphertext each time)
        encrypted_national_id = self.crypto.encrypt_for_storage(national_id)
        encrypted_name = self.crypto.encrypt_for_storage(name)

        # Store full data as encrypted JSON
        full_data = {
            "national_id": national_id,
            "name": name,
            "additional_data": additional_data,
        }
        encrypted_data = self.crypto.encrypt_for_storage(json.dumps(full_data))

        # Column B: Blind index (deterministic HMAC-SHA256)
        national_id_index = self.crypto.create_blind_index(national_id)

        record = VerificationRecord(
            id=record_id,
            encrypted_national_id=encrypted_national_id,
            encrypted_name=encrypted_name,
            encrypted_data=encrypted_data,
            national_id_index=national_id_index,
        )

        try:
            self.db.add(record)
            self.db.commit()
            return record_id
        except IntegrityError:
            self.db.rollback()
            raise ValueError("Record with this National ID already exists")

    def search_by_national_id(self, national_id: str) -> Optional[dict]:
        """Search for a record using blind index (exact match).

        Args:
            national_id: National ID to search for

        Returns:
            Decrypted record data or None if not found
        """
        # Create blind index for the search query
        search_index = self.crypto.create_blind_index(national_id)

        # Query using the blind index (Column B)
        record = (
            self.db.query(VerificationRecord)
            .filter(VerificationRecord.national_id_index == search_index)
            .first()
        )

        if not record:
            return None

        # Decrypt the stored data (Column A)
        decrypted_data_json = self.crypto.decrypt_from_storage(record.encrypted_data)
        decrypted_data = json.loads(decrypted_data_json)

        return {
            "national_id": decrypted_data["national_id"],
            "name": decrypted_data["name"],
            "additional_data": decrypted_data.get("additional_data"),
            "created_at": record.created_at,
        }

    def get_all_records(self) -> list:
        """Get all records (for testing/admin purposes).

        Returns:
            List of all records with decrypted data
        """
        records = self.db.query(VerificationRecord).all()
        result = []

        for record in records:
            decrypted_data_json = self.crypto.decrypt_from_storage(
                record.encrypted_data
            )
            decrypted_data = json.loads(decrypted_data_json)
            result.append(
                {
                    "id": record.id,
                    "national_id": decrypted_data["national_id"],
                    "name": decrypted_data["name"],
                    "additional_data": decrypted_data.get("additional_data"),
                    "created_at": record.created_at,
                }
            )

        return result
