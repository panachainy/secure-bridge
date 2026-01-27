# Usage Guide - Secure Bridge Library

This guide demonstrates how to use the Secure Bridge Library for implementing end-to-end encryption in your applications.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Client-Side Implementation](#client-side-implementation)
3. [Server-Side Implementation](#server-side-implementation)
4. [Advanced Usage](#advanced-usage)
5. [Security Best Practices](#security-best-practices)

## Basic Usage

### Installation

```bash
# Using Bun
bun install secure-bridge-lib
```

### Quick Example

```typescript
import { SecureBridge, RSAKeyPairManager } from 'secure-bridge-lib';

// Server: Generate and store RSA key pair (once)
const serverKeys = RSAKeyPairManager.generateKeyPair();

// Client: Encrypt sensitive data
const payload = JSON.stringify({ nationalId: '1234567890123' });
const encrypted = SecureBridge.encryptRequest(payload, serverKeys.publicKey);

// Server: Decrypt the request
const decrypted = SecureBridge.decryptRequest(encrypted, serverKeys.privateKey);
console.log(decrypted); // {"nationalId":"1234567890123"}
```

## Client-Side Implementation

### Example: React Application

```typescript
// hooks/useSecureSubmit.ts
import { SecureBridge } from 'secure-bridge-lib';

export function useSecureSubmit() {
  const [serverPublicKey, setServerPublicKey] = useState<string | null>(null);

  // Fetch server's public key on mount
  useEffect(() => {
    fetch('/api/public-key')
      .then(res => res.json())
      .then(data => setServerPublicKey(data.publicKey));
  }, []);

  const submitSecureData = async (data: any) => {
    if (!serverPublicKey) {
      throw new Error('Server public key not available');
    }

    const payload = JSON.stringify(data);
    const encrypted = SecureBridge.encryptRequest(payload, serverPublicKey);

    const response = await fetch('/api/secure-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encrypted),
    });

    return response.json();
  };

  return { submitSecureData, isReady: !!serverPublicKey };
}
```

### Example: Form Submission

```typescript
// components/SecureForm.tsx
import { useSecureSubmit } from '../hooks/useSecureSubmit';

export function SecureForm() {
  const { submitSecureData, isReady } = useSecureSubmit();
  const [nationalId, setNationalId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submitSecureData({
        nationalId,
        timestamp: new Date().toISOString(),
      });
      alert('Submitted securely!');
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={nationalId}
        onChange={(e) => setNationalId(e.target.value)}
        placeholder="National ID"
        disabled={!isReady}
      />
      <button type="submit" disabled={!isReady}>
        Submit Securely
      </button>
    </form>
  );
}
```

## Server-Side Implementation

### Example: Express.js Server

```typescript
// server.ts
import express from 'express';
import { SecureBridge, RSAKeyPairManager } from 'secure-bridge-lib';
import fs from 'fs';

const app = express();
app.use(express.json());

// Load or generate RSA keys
let serverKeys;
try {
  serverKeys = {
    publicKey: fs.readFileSync('./keys/public.pem', 'utf8'),
    privateKey: fs.readFileSync('./keys/private.pem', 'utf8'),
  };
} catch {
  // Generate new keys if not found
  serverKeys = RSAKeyPairManager.generateKeyPair();
  fs.mkdirSync('./keys', { recursive: true });
  fs.writeFileSync('./keys/public.pem', serverKeys.publicKey);
  fs.writeFileSync('./keys/private.pem', serverKeys.privateKey);
}

// Endpoint to provide public key to clients
app.get('/api/public-key', (req, res) => {
  res.json({ publicKey: serverKeys.publicKey });
});

// Secure endpoint
app.post('/api/secure-submit', (req, res) => {
  try {
    // Decrypt the request
    const decryptedPayload = SecureBridge.decryptRequest(
      req.body,
      serverKeys.privateKey
    );

    const data = JSON.parse(decryptedPayload);
    console.log('Received secure data:', data);

    // Process the data
    // ... your business logic here ...

    res.json({ success: true, message: 'Data received securely' });
  } catch (error) {
    console.error('Decryption failed:', error);
    res.status(400).json({ error: 'Invalid encrypted data' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Example: Next.js API Route

```typescript
// pages/api/secure-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { SecureBridge } from 'secure-bridge-lib';
import { getServerKeys } from '@/lib/keys';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const serverKeys = await getServerKeys();

    // Decrypt the encrypted payload
    const decryptedPayload = SecureBridge.decryptRequest(
      req.body,
      serverKeys.privateKey
    );

    const data = JSON.parse(decryptedPayload);

    // Validate and process data
    if (!data.nationalId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ... your business logic ...

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Decryption error:', error);
    res.status(400).json({ error: 'Invalid encrypted data' });
  }
}
```

## Advanced Usage

### Custom Key Management

```typescript
import { RSAKeyPairManager, AES256GCM } from 'secure-bridge-lib';

class KeyManager {
  private static instance: KeyManager;
  private keys: Map<string, any> = new Map();

  static getInstance(): KeyManager {
    if (!this.instance) {
      this.instance = new KeyManager();
    }
    return this.instance;
  }

  async rotateKeys(userId: string) {
    // Generate new key pair for user
    const newKeys = RSAKeyPairManager.generateKeyPair();

    // Store with timestamp
    this.keys.set(userId, {
      ...newKeys,
      createdAt: Date.now(),
    });

    return newKeys.publicKey;
  }

  getPrivateKey(userId: string): string {
    const userKeys = this.keys.get(userId);
    if (!userKeys) {
      throw new Error('Keys not found for user');
    }
    return userKeys.privateKey;
  }
}
```

### Batch Encryption

```typescript
import { SecureBridge } from 'secure-bridge-lib';

async function encryptBatch(items: any[], publicKey: string) {
  return items.map(item => ({
    id: item.id,
    encrypted: SecureBridge.encryptRequest(
      JSON.stringify(item.data),
      publicKey
    ),
  }));
}

// Usage
const data = [
  { id: 1, data: { nationalId: '1111111111111' } },
  { id: 2, data: { nationalId: '2222222222222' } },
];

const encryptedBatch = await encryptBatch(data, serverPublicKey);
```

### Response Encryption (Bidirectional)

```typescript
// Server encrypts response
import { SecureBridge, RSAKeyPairManager } from 'secure-bridge-lib';

// Client generates their own key pair
const clientKeys = RSAKeyPairManager.generateKeyPair();

// Client sends their public key with request
const request = {
  encrypted: SecureBridge.encryptRequest(data, serverPublicKey),
  clientPublicKey: clientKeys.publicKey,
};

// Server encrypts response using client's public key
const responseData = { status: 'success', result: {...} };
const encryptedResponse = SecureBridge.encryptRequest(
  JSON.stringify(responseData),
  request.clientPublicKey
);

// Client decrypts response
const decryptedResponse = SecureBridge.decryptRequest(
  encryptedResponse,
  clientKeys.privateKey
);
```

## Security Best Practices

### 1. Key Storage

**❌ DON'T:**
```typescript
// Never hardcode keys in source code
const privateKey = "-----BEGIN PRIVATE KEY-----\nMIIE...";
```

**✅ DO:**
```typescript
// Store keys securely
import { readFileSync } from 'fs';

// Use environment-specific key files
const privateKey = readFileSync(
  process.env.PRIVATE_KEY_PATH || './keys/private.pem',
  'utf8'
);

// Or use environment variables
const privateKey = process.env.PRIVATE_KEY;
```

### 2. Key Rotation

```typescript
// Implement periodic key rotation
class KeyRotationService {
  private rotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days

  async checkAndRotate() {
    const lastRotation = await this.getLastRotationDate();

    if (Date.now() - lastRotation > this.rotationInterval) {
      await this.rotateKeys();
    }
  }

  private async rotateKeys() {
    const newKeys = RSAKeyPairManager.generateKeyPair();

    // Store new keys
    await this.storeKeys(newKeys);

    // Keep old keys for grace period
    await this.archiveOldKeys();

    // Notify clients of new public key
    await this.broadcastNewPublicKey(newKeys.publicKey);
  }
}
```

### 3. Input Validation

```typescript
// Always validate decrypted data
function processSecureRequest(encrypted: any, privateKey: string) {
  try {
    const decrypted = SecureBridge.decryptRequest(encrypted, privateKey);
    const data = JSON.parse(decrypted);

    // Validate structure
    if (!data.nationalId || typeof data.nationalId !== 'string') {
      throw new Error('Invalid data structure');
    }

    // Validate format
    if (!/^\d{13}$/.test(data.nationalId)) {
      throw new Error('Invalid national ID format');
    }

    return data;
  } catch (error) {
    console.error('Request processing failed:', error);
    throw error;
  }
}
```

### 4. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

// Limit encryption requests to prevent abuse
const encryptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many encryption requests',
});

app.post('/api/secure-submit', encryptionLimiter, handler);
```

### 5. Logging and Monitoring

```typescript
// Log encryption events (but never log keys or plaintext!)
function secureLog(event: string, metadata: any) {
  console.log({
    timestamp: new Date().toISOString(),
    event,
    // Only log non-sensitive metadata
    requestId: metadata.requestId,
    success: metadata.success,
    // NEVER log: keys, plaintext, decrypted data
  });
}

// Usage
app.post('/api/secure-submit', (req, res) => {
  const requestId = generateRequestId();

  try {
    const decrypted = SecureBridge.decryptRequest(req.body, privateKey);
    secureLog('decryption_success', { requestId, success: true });
    // ... process data ...
  } catch (error) {
    secureLog('decryption_failed', { requestId, success: false });
    res.status(400).json({ error: 'Decryption failed' });
  }
});
```

### 6. HTTPS Only

```typescript
// Force HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

## Common Pitfalls

### ❌ Reusing AES Keys
```typescript
// DON'T reuse the same AES key
const key = AES256GCM.generateKey();
const enc1 = AES256GCM.encrypt(data1, key); // ❌
const enc2 = AES256GCM.encrypt(data2, key); // ❌
```

### ✅ Use Fresh Keys (Automatic)
```typescript
// DO let the library generate fresh keys
const enc1 = SecureBridge.encryptRequest(data1, publicKey); // ✅
const enc2 = SecureBridge.encryptRequest(data2, publicKey); // ✅
```

### ❌ Ignoring Errors
```typescript
// DON'T ignore decryption errors
const data = SecureBridge.decryptRequest(encrypted, privateKey); // ❌
```

### ✅ Handle Errors Properly
```typescript
// DO handle errors properly
try {
  const data = SecureBridge.decryptRequest(encrypted, privateKey);
  // ... process data ...
} catch (error) {
  console.error('Decryption failed:', error);
  // Handle error appropriately
}
```

## Testing

```typescript
import { describe, test, expect } from 'bun:test';
import { SecureBridge, RSAKeyPairManager } from 'secure-bridge-lib';

describe('Secure Communication', () => {
  test('should handle full encryption workflow', () => {
    const serverKeys = RSAKeyPairManager.generateKeyPair();
    const data = { nationalId: '1234567890123' };

    const encrypted = SecureBridge.encryptRequest(
      JSON.stringify(data),
      serverKeys.publicKey
    );

    const decrypted = SecureBridge.decryptRequest(
      encrypted,
      serverKeys.privateKey
    );

    expect(JSON.parse(decrypted)).toEqual(data);
  });
});
```

## Performance Considerations

- **AES-256-GCM**: Very fast, suitable for large payloads
- **RSA-2048**: Slower, only used for AES key encryption (small data)
- **Fresh Keys**: Minimal overhead, cryptographically important
- **Large Payloads**: AES handles large data efficiently (tested up to several MB)

## License

MIT
