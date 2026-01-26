# Verification Service

Part 2: The Python Verification Service (Backend)
> Requirement: Build a Python web service (FastAPI/Flask/Django) to handle the secure ingress.

- Secure Ingress Endpoint:
  - Accept the encrypted payload from the library.
  - Decryption: Use the Private Key to recover the Symmetric Key, then decrypt the data.
- Secure Storage (Blind Indexing):
  - Column A (Storage): Store the data using Randomized Encryption (different ciphertext every time).
  - Column B (Search Index): Store the data using HMAC-SHA256 (Deterministic) for exact matching.
- Search Endpoint:
  - Implement an API to search by National ID using the Blind Index approach (Exact match).
