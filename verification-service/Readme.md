# Verification Service

Part 2: The Python Verification Service (Backend)
> Requirement: Build a Python web service (FastAPI/Flask/Django) to handle the secure ingress.

## Features Implemented

### 1. Secure Ingress Endpoint (`POST /api/v1/ingress`)
- **Accept encrypted payload** from the library using hybrid encryption
- **Decryption Process**:
  1. Use RSA Private Key to decrypt the symmetric key
  2. Use the symmetric key (AES) to decrypt the actual data
- **Response**: Returns success status and record ID

### 2. Secure Storage with Blind Indexing
The service implements a dual-column approach for privacy-preserving storage:

- **Column A (Storage)**: Uses **Randomized Encryption** (AES-CBC with random IV)
  - Same data encrypted multiple times produces different ciphertext
  - Prevents pattern analysis attacks
  - Fields: `encrypted_national_id`, `encrypted_name`, `encrypted_data`

- **Column B (Search Index)**: Uses **HMAC-SHA256** (Deterministic)
  - Same input always produces same hash
  - Enables exact matching without revealing plaintext
  - Field: `national_id_index`

### 3. Search Endpoint (`POST /api/v1/search`)
- **Blind Index Search**: Query by National ID using HMAC-based index
- **Exact Match**: Deterministic hashing enables precise lookups
- **Decryption**: Returns decrypted data if found

## Architecture

```
┌─────────────┐    Encrypted     ┌──────────────────┐
│   Client    │ ═══════════════> │  Ingress API     │
│   Library   │   (Hybrid Enc)   │  /api/v1/ingress │
└─────────────┘                  └──────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │ Crypto Service  │
                                 │ - RSA Decrypt   │
                                 │ - AES Decrypt   │
                                 └─────────────────┘
                                          │
                                          ▼
                         ┌────────────────────────────────┐
                         │  Storage (PostgreSQL)          │
                         │                                │
                         │  Column A (Randomized):        │
                         │  - encrypted_national_id       │
                         │  - encrypted_name              │
                         │  - encrypted_data              │
                         │                                │
                         │  Column B (Deterministic):     │
                         │  - national_id_index (HMAC)    │
                         └────────────────────────────────┘
                                          ▲
                                          │
                                 ┌─────────────────┐
                                 │  Search API     │
                                 │  /api/v1/search │
                                 └─────────────────┘
```

## API Endpoints

### 1. Get Public Key
```
GET /api/v1/public-key
```
Returns the RSA public key for client encryption.

**Response:**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...",
  "format": "PEM"
}
```

### 2. Secure Ingress
```
POST /api/v1/ingress
```

**Request Body:**
```json
{
  "encrypted_symmetric_key": "base64-encoded-rsa-encrypted-key",
  "encrypted_data": "base64-encoded-aes-encrypted-data"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data received and stored securely",
  "record_id": "uuid-v4"
}
```

### 3. Search by National ID
```
POST /api/v1/search
```

**Request Body:**
```json
{
  "national_id": "1234567890123"
}
```

**Response (Found):**
```json
{
  "found": true,
  "national_id": "1234567890123",
  "name": "John Doe",
  "additional_data": {"phone": "555-0123"},
  "created_at": "2026-01-27T10:30:00"
}
```

**Response (Not Found):**
```json
{
  "found": false
}
```

### 4. Get All Records (Testing/Admin)
```
GET /api/v1/records
```
Returns all decrypted records. ⚠️ **Remove or protect in production!**

## Security Implementation

### Hybrid Encryption (Ingress)
1. **Client Side**:
   - Generate random AES-256 symmetric key
   - Encrypt data with AES-CBC
   - Encrypt symmetric key with RSA public key
   - Send both encrypted pieces

2. **Server Side**:
   - Decrypt symmetric key using RSA private key
   - Decrypt data using symmetric key
   - Store with blind indexing

### Blind Indexing
```python
# For Storage (Column A - Randomized)
encrypted = encrypt_randomized(data)  # Different ciphertext each time

# For Search (Column B - Deterministic)
index = HMAC-SHA256(secret_key, national_id)  # Same hash for same input
```

## Setup & Running

### Prerequisites
- Python 3.12+
- Poetry (for dependency management)
- Docker & Docker Compose
- PostgreSQL (via Docker)

### Quick Start

1. **Install Dependencies**:
```bash
# Install Poetry if you don't have it
curl -sSL https://install.python-poetry.org | python3 -

# Install project dependencies
poetry install
```

2. **Configure Environment**:
```bash
cp .env.example .env
# Edit .env with your secure keys
```

3. **Run with Docker Compose**:
```bash
docker compose up -d
```

The service will be available at `http://localhost:8000`

4. **View Logs**:
```bash
docker compose logs -f verification-service
```

### Local Development

```bash
# Install dependencies
make install

# Run with auto-reload
make dev

# Run tests
make test
```

## Testing

### Using Example Client

```bash
# Install client dependencies
pip install requests cryptography

# Run example client
python example_client.py
```

The example client demonstrates:
- Fetching public key
- Encrypting data with hybrid encryption
- Sending encrypted payload
- Searching records

### Manual Testing with cURL

1. **Get Public Key**:
```bash
curl http://localhost:8000/api/v1/public-key
```

2. **Health Check**:
```bash
curl http://localhost:8000/
```

3. **Search** (after inserting data):
```bash
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"national_id": "1234567890123"}'
```

## Database Schema

```sql
CREATE TABLE verification_records (
    id VARCHAR(36) PRIMARY KEY,

    -- Column A: Randomized Encryption (Storage)
    encrypted_national_id TEXT NOT NULL,
    encrypted_name TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,

    -- Column B: Blind Index (Search)
    national_id_index VARCHAR(64) UNIQUE NOT NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_national_id_index ON verification_records(national_id_index);
```

## Security Considerations

### ✅ Implemented
- Hybrid encryption (RSA + AES)
- Blind indexing with HMAC-SHA256
- Randomized storage encryption
- Deterministic search index
- Automatic key generation
- Encrypted data at rest

### ⚠️ Production Recommendations
1. **Key Management**:
   - Use AWS KMS, Azure Key Vault, or HashiCorp Vault
   - Never commit keys to version control
   - Implement key rotation

2. **Environment Variables**:
   - Use strong random keys (32+ bytes)
   - Different keys per environment
   - Store in secure secrets manager

3. **Database**:
   - Enable SSL/TLS connections
   - Use database encryption at rest
   - Regular backups with encryption

4. **API Security**:
   - Add authentication (JWT, OAuth2)
   - Rate limiting
   - API key management
   - CORS configuration
   - Remove admin endpoints

5. **Monitoring**:
   - Audit logging
   - Anomaly detection
   - Key usage monitoring

## Project Structure

```
verification-service/
├── app/
│   ├── main.py              # FastAPI application & endpoints
│   ├── config.py            # Configuration management
│   ├── crypto_service.py    # Encryption/decryption logic
│   ├── database.py          # SQLAlchemy models & setup
│   ├── repository.py        # Database operations
│   └── schemas.py           # Pydantic schemas
├── keys/
│   ├── .gitignore          # Prevent committing keys
│   └── README.md           # Key management docs
├── docker-compose.yml      # Multi-container setup
├── Dockerfile              # Service container
├── pyproject.toml          # Python dependencies
├── example_client.py       # Example encryption client
└── Readme.md              # This file
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@db:5432/verification_db` |
| `PRIVATE_KEY_PATH` | Path to RSA private key | `/app/keys/private_key.pem` |
| `HMAC_SECRET_KEY` | Secret for blind indexing | *Change in production!* |
| `STORAGE_ENCRYPTION_KEY` | Key for storage encryption (32 bytes) | *Change in production!* |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `DEBUG` | Debug mode | `false` |

## Troubleshooting

### Database Connection Issues
```bash
# Check if database is running
docker compose ps

# View database logs
docker compose logs db

# Restart services
docker compose restart
```

### Private Key Issues
```bash
# Generate new key manually
openssl genrsa -out keys/private_key.pem 2048

# Verify key
openssl rsa -in keys/private_key.pem -check
```

### Dependencies
```bash
# Rebuild with updated dependencies
docker compose up --build
```

## License

MIT
