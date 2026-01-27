import { SecureBridge, RSAKeyPairManager, AES256GCM } from "./index";

console.log("=".repeat(60));
console.log("Secure Bridge Library - Example Usage");
console.log("=".repeat(60));

// ============================================================
// Example 1: Complete Workflow (High-Level API)
// ============================================================
console.log("\n📦 Example 1: Complete Encryption/Decryption Workflow\n");

// Server: Generate RSA key pair (do this once)
const serverKeys = RSAKeyPairManager.generateKeyPair();
console.log("✓ Server RSA key pair generated");
console.log(
  `  Public Key (first 50 chars): ${serverKeys.publicKey.substring(0, 50)}...`,
);

// Client: Prepare and encrypt request
const sensitiveData = {
  nationalId: "1234567890123",
  name: "John Doe",
  email: "john@example.com",
  timestamp: new Date().toISOString(),
};

const payload = JSON.stringify(sensitiveData);
console.log(`\n📤 Client encrypting payload:`, payload);

const encryptedRequest = SecureBridge.encryptRequest(
  payload,
  serverKeys.publicKey,
);
console.log("\n✓ Encrypted Request:");
console.log(`  Ciphertext: ${encryptedRequest.ciphertext.substring(0, 40)}...`);
console.log(
  `  Encrypted AES Key: ${encryptedRequest.encryptedAESKey.substring(0, 40)}...`,
);
console.log(`  IV: ${encryptedRequest.iv}`);
console.log(`  Auth Tag: ${encryptedRequest.authTag}`);

// Server: Decrypt request
const decryptedPayload = SecureBridge.decryptRequest(
  encryptedRequest,
  serverKeys.privateKey,
);
console.log(`\n📥 Server decrypted payload:`, decryptedPayload);

const decryptedData = JSON.parse(decryptedPayload);
console.log("✓ Decryption successful!");
console.log(`  National ID: ${decryptedData.nationalId}`);
console.log(`  Name: ${decryptedData.name}`);

// ============================================================
// Example 2: Low-Level AES Operations
// ============================================================
console.log("\n\n📦 Example 2: Low-Level AES-256-GCM Operations\n");

const message = "This is a secret message!";
console.log(`Original message: "${message}"`);

// Encrypt
const aesEncrypted = AES256GCM.encrypt(message);
console.log("\n✓ AES Encrypted:");
console.log(`  Ciphertext: ${aesEncrypted.ciphertext}`);
console.log(`  Key: ${aesEncrypted.key.substring(0, 30)}...`);
console.log(`  IV: ${aesEncrypted.iv}`);
console.log(`  Auth Tag: ${aesEncrypted.authTag}`);

// Decrypt
const aesDecrypted = AES256GCM.decrypt({
  ciphertext: aesEncrypted.ciphertext,
  iv: aesEncrypted.iv,
  authTag: aesEncrypted.authTag,
  key: aesEncrypted.key,
});
console.log(`\n✓ AES Decrypted: "${aesDecrypted}"`);
console.log(`Match: ${message === aesDecrypted}`);

// ============================================================
// Example 3: Low-Level RSA Operations
// ============================================================
console.log("\n\n📦 Example 3: Low-Level RSA Operations\n");

const keyPair = RSAKeyPairManager.generateKeyPair();
console.log("✓ RSA key pair generated");

// Encrypt an AES key with RSA
const aesKey = AES256GCM.generateKey();
console.log(`\nOriginal AES Key: ${aesKey.substring(0, 30)}...`);

const encryptedKey = RSAKeyPairManager.encryptWithPublicKey(
  aesKey,
  keyPair.publicKey,
);
console.log(`✓ Encrypted with RSA: ${encryptedKey.substring(0, 40)}...`);

const decryptedKey = RSAKeyPairManager.decryptWithPrivateKey(
  encryptedKey,
  keyPair.privateKey,
);
console.log(`✓ Decrypted with RSA: ${decryptedKey.substring(0, 30)}...`);
console.log(`Match: ${aesKey === decryptedKey}`);

// ============================================================
// Example 4: Multiple Requests with Fresh Keys
// ============================================================
console.log("\n\n📦 Example 4: Multiple Requests (Each with Fresh AES Key)\n");

const requests = [
  { id: 1, data: "First request" },
  { id: 2, data: "Second request" },
  { id: 3, data: "Third request" },
];

requests.forEach((req) => {
  const encrypted = SecureBridge.encryptRequest(
    JSON.stringify(req),
    serverKeys.publicKey,
  );
  const decrypted = SecureBridge.decryptRequest(
    encrypted,
    serverKeys.privateKey,
  );
  console.log(`✓ Request ${req.id}: ${decrypted}`);
});

// ============================================================
// Example 5: Error Handling - Tampered Data
// ============================================================
console.log("\n\n📦 Example 5: Security - Detecting Tampered Data\n");

const originalEncrypted = SecureBridge.encryptRequest(
  "Important data",
  serverKeys.publicKey,
);

// Simulate tampering with ciphertext
const tamperedPayload = {
  ...originalEncrypted,
  ciphertext: "TamperedDataHere" + originalEncrypted.ciphertext.substring(16), // Tamper with data
};

try {
  SecureBridge.decryptRequest(tamperedPayload, serverKeys.privateKey);
  console.log("❌ Should have detected tampering!");
} catch (error) {
  console.log("✓ Tampering detected! Authentication failed.");
  console.log(
    `  Error: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
}

console.log("\n" + "=".repeat(60));
console.log("All examples completed successfully! ✅");
console.log("=".repeat(60));
