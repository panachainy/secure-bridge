"""Database models and setup."""

from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

Base = declarative_base()


class VerificationRecord(Base):
    """Model for storing verification records with blind indexing."""

    __tablename__ = "verification_records"

    # Primary key
    id = Column(String(36), primary_key=True)

    # Column A: Randomized encrypted storage (different ciphertext each time)
    encrypted_national_id = Column(Text, nullable=False)
    encrypted_name = Column(Text, nullable=False)
    encrypted_data = Column(Text, nullable=False)  # Store full JSON

    # Column B: Blind index for searching (deterministic HMAC-SHA256)
    national_id_index = Column(String(64), unique=True, index=True, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Database setup
engine = create_engine(settings.database_url, echo=settings.debug)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
