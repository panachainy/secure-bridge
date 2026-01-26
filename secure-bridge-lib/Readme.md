# E2E Encrypted Bridge for TypeScript

Part 1: "Secure Bridge" (TypeScript Library)
> Requirement: Create a standalone TypeScript library (e.g., a class or module) that abstracts away the complexity of cryptography.

- Core Logic (Hybrid Encryption):
- The library must accept a Public Key (RSA/ECC) upon initialization.
- For every submission:

  1. Generate a transient Symmetric Key (e.g., AES-256).
  2. Encrypt the payload (National ID) with this Symmetric Key.
  3. Encrypt the Symmetric Key itself using the Server's Public Key.
  4. Return the packaged payload: { encrypted_data: "...", encrypted_key: "..." }.

- Deliverable: A TypeScript file/module demonstrating this logic.

## Sequence diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant AES as "[LIB] AES-256-GCM"
    participant RSA as "[LIB] RSA Key Pair"
    participant Server

    Note over Server,RSA: Server owns RSA key pair<br/>Public key exposed to clients

    Client->>AES: Generate random AES-256 key
    Client->>AES: Encrypt request payload<br/>(AES key + IV)
    AES-->>Client: Ciphertext + AuthTag

    Client->>RSA: Encrypt AES key with Server Public Key<br/>(RSA-OAEP + SHA-256)
    RSA-->>Client: Encrypted AES Key

    Client->>Server: POST request<br/>{Ciphertext, Encrypted AES Key, IV, AuthTag}

    Server->>RSA: Decrypt AES key using Private Key
    RSA-->>Server: AES-256 Key

    Server->>AES: Decrypt payload using AES-GCM<br/>(AES key + IV + AuthTag)
    AES-->>Server: Plaintext Request

    Server->>Client: Process request & respond (optional encrypted response)
```
