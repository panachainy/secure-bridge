import { describe, test, expect } from "bun:test";
import { SecureBridge, RSAKeyPairManager, AES256GCM } from "./index";

describe("AES256GCM", () => {
  test("should generate a valid key", () => {
    const key = AES256GCM.generateKey();
    expect(key).toBeDefined();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  test("should encrypt and decrypt data correctly", () => {
    const plaintext = "Hello, World!";
    const encrypted = AES256GCM.encrypt(plaintext);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.key).toBeDefined();

    const decrypted = AES256GCM.decrypt({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      key: encrypted.key,
    });

    expect(decrypted).toBe(plaintext);
  });

  test("should fail on tampered data", () => {
    const plaintext = "Secret data";
    const encrypted = AES256GCM.encrypt(plaintext);

    // Tamper with ciphertext
    const tampered = {
      ...encrypted,
      ciphertext: "TAMPERED" + encrypted.ciphertext.substring(8),
    };

    expect(() => {
      AES256GCM.decrypt(tampered);
    }).toThrow();
  });

  test("should fail on wrong auth tag", () => {
    const plaintext = "Secret data";
    const encrypted = AES256GCM.encrypt(plaintext);

    // Use wrong auth tag
    const tampered = {
      ...encrypted,
      authTag: AES256GCM.generateIV(), // Wrong tag
    };

    expect(() => {
      AES256GCM.decrypt(tampered);
    }).toThrow();
  });
});

describe("RSAKeyPairManager", () => {
  test("should generate a valid key pair", () => {
    const keyPair = RSAKeyPairManager.generateKeyPair();

    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(keyPair.privateKey).toContain("BEGIN PRIVATE KEY");
  });

  test("should encrypt and decrypt data correctly", () => {
    const keyPair = RSAKeyPairManager.generateKeyPair();
    const data = AES256GCM.generateKey(); // Use AES key as test data

    const encrypted = RSAKeyPairManager.encryptWithPublicKey(
      data,
      keyPair.publicKey,
    );
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe("string");

    const decrypted = RSAKeyPairManager.decryptWithPrivateKey(
      encrypted,
      keyPair.privateKey,
    );
    expect(decrypted).toBe(data);
  });

  test("should fail with wrong private key", () => {
    const keyPair1 = RSAKeyPairManager.generateKeyPair();
    const keyPair2 = RSAKeyPairManager.generateKeyPair();
    const data = AES256GCM.generateKey();

    const encrypted = RSAKeyPairManager.encryptWithPublicKey(
      data,
      keyPair1.publicKey,
    );

    expect(() => {
      RSAKeyPairManager.decryptWithPrivateKey(encrypted, keyPair2.privateKey);
    }).toThrow();
  });
});

describe("SecureBridge", () => {
  test("should encrypt and decrypt request correctly", () => {
    const serverKeys = RSAKeyPairManager.generateKeyPair();
    const payload = JSON.stringify({
      nationalId: "1234567890123",
      name: "Test User",
    });

    const encrypted = SecureBridge.encryptRequest(
      payload,
      serverKeys.publicKey,
    );

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.encryptedAESKey).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = SecureBridge.decryptRequest(
      encrypted,
      serverKeys.privateKey,
    );
    expect(decrypted).toBe(payload);

    const parsed = JSON.parse(decrypted);
    expect(parsed.nationalId).toBe("1234567890123");
    expect(parsed.name).toBe("Test User");
  });

  test("should use fresh AES key for each request", () => {
    const serverKeys = RSAKeyPairManager.generateKeyPair();
    const payload = "test data";

    const encrypted1 = SecureBridge.encryptRequest(
      payload,
      serverKeys.publicKey,
    );
    const encrypted2 = SecureBridge.encryptRequest(
      payload,
      serverKeys.publicKey,
    );

    // Different encrypted AES keys (because fresh keys are generated)
    expect(encrypted1.encryptedAESKey).not.toBe(encrypted2.encryptedAESKey);

    // Different ciphertexts (because of different keys and IVs)
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

    // But both decrypt to the same payload
    const decrypted1 = SecureBridge.decryptRequest(
      encrypted1,
      serverKeys.privateKey,
    );
    const decrypted2 = SecureBridge.decryptRequest(
      encrypted2,
      serverKeys.privateKey,
    );
    expect(decrypted1).toBe(payload);
    expect(decrypted2).toBe(payload);
  });

  test("should fail with tampered ciphertext", () => {
    const serverKeys = RSAKeyPairManager.generateKeyPair();
    const payload = "sensitive data";

    const encrypted = SecureBridge.encryptRequest(
      payload,
      serverKeys.publicKey,
    );
    const tampered = {
      ...encrypted,
      ciphertext: "TAMPERED" + encrypted.ciphertext.substring(8),
    };

    expect(() => {
      SecureBridge.decryptRequest(tampered, serverKeys.privateKey);
    }).toThrow();
  });

  test("should fail with wrong server private key", () => {
    const serverKeys1 = RSAKeyPairManager.generateKeyPair();
    const serverKeys2 = RSAKeyPairManager.generateKeyPair();
    const payload = "data";

    const encrypted = SecureBridge.encryptRequest(
      payload,
      serverKeys1.publicKey,
    );

    expect(() => {
      SecureBridge.decryptRequest(encrypted, serverKeys2.privateKey);
    }).toThrow();
  });

  test("should handle large payloads", () => {
    const serverKeys = RSAKeyPairManager.generateKeyPair();
    const largePayload = JSON.stringify({
      data: "x".repeat(10000),
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    });

    const encrypted = SecureBridge.encryptRequest(
      largePayload,
      serverKeys.publicKey,
    );
    const decrypted = SecureBridge.decryptRequest(
      encrypted,
      serverKeys.privateKey,
    );

    expect(decrypted).toBe(largePayload);
  });
});
