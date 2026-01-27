import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  publicEncrypt,
  privateDecrypt,
  generateKeyPairSync,
  constants,
} from "crypto";

/**
 * AES-256-GCM Configuration
 */
export interface AESEncryptionResult {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  key: string; // Base64 encoded (for transmission)
}

export interface AESDecryptionInput {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  key: string; // Base64 encoded
}

/**
 * RSA Key Pair
 */
export interface RSAKeyPair {
  publicKey: string; // PEM format
  privateKey: string; // PEM format
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded
  encryptedAESKey: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
}

/**
 * AES-256-GCM Encryption Module
 */
export class AES256GCM {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12; // 96 bits (recommended for GCM)
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits

  /**
   * Generate a random AES-256 key
   * @returns Base64 encoded AES key
   */
  static generateKey(): string {
    return randomBytes(this.KEY_LENGTH).toString("base64");
  }

  /**
   * Generate a random IV (Initialization Vector)
   * @returns Base64 encoded IV
   */
  static generateIV(): string {
    return randomBytes(this.IV_LENGTH).toString("base64");
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param plaintext - Data to encrypt
   * @param key - Optional Base64 encoded AES key (generates new if not provided)
   * @returns Encryption result with ciphertext, IV, authTag, and key
   */
  static encrypt(plaintext: string, key?: string): AESEncryptionResult {
    // Generate or use provided key
    const aesKey = key || this.generateKey();
    const keyBuffer = Buffer.from(aesKey, "base64");

    // Generate random IV
    const iv = this.generateIV();
    const ivBuffer = Buffer.from(iv, "base64");

    // Create cipher
    const cipher = createCipheriv(this.ALGORITHM, keyBuffer, ivBuffer);

    // Encrypt
    let ciphertext = cipher.update(plaintext, "utf8", "base64");
    ciphertext += cipher.final("base64");

    // Get authentication tag
    const authTag = cipher.getAuthTag().toString("base64");

    return {
      ciphertext,
      iv,
      authTag,
      key: aesKey,
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param input - Decryption input containing ciphertext, IV, authTag, and key
   * @returns Decrypted plaintext
   * @throws Error if authentication fails or decryption fails
   */
  static decrypt(input: AESDecryptionInput): string {
    const { ciphertext, iv, authTag, key } = input;

    // Convert from Base64
    const keyBuffer = Buffer.from(key, "base64");
    const ivBuffer = Buffer.from(iv, "base64");
    const authTagBuffer = Buffer.from(authTag, "base64");

    // Create decipher
    const decipher = createDecipheriv(this.ALGORITHM, keyBuffer, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt
    let plaintext = decipher.update(ciphertext, "base64", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
  }
}

/**
 * RSA Key Pair Module (RSA-OAEP with SHA-256)
 */
export class RSAKeyPairManager {
  private static readonly KEY_SIZE = 2048; // bits

  /**
   * Generate RSA key pair
   * @returns Public and private keys in PEM format
   */
  static generateKeyPair(): RSAKeyPair {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: this.KEY_SIZE,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    return {
      publicKey,
      privateKey,
    };
  }

  /**
   * Encrypt data using RSA public key (RSA-OAEP with SHA-256)
   * Typically used to encrypt AES keys
   * @param data - Data to encrypt (typically an AES key)
   * @param publicKeyPEM - Public key in PEM format
   * @returns Base64 encoded encrypted data
   */
  static encryptWithPublicKey(data: string, publicKeyPEM: string): string {
    const buffer = Buffer.from(data, "base64");
    const encrypted = publicEncrypt(
      {
        key: publicKeyPEM,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      buffer,
    );
    return encrypted.toString("base64");
  }

  /**
   * Decrypt data using RSA private key (RSA-OAEP with SHA-256)
   * @param encryptedData - Base64 encoded encrypted data
   * @param privateKeyPEM - Private key in PEM format
   * @returns Decrypted data in Base64 format (typically an AES key)
   */
  static decryptWithPrivateKey(
    encryptedData: string,
    privateKeyPEM: string,
  ): string {
    const buffer = Buffer.from(encryptedData, "base64");
    const decrypted = privateDecrypt(
      {
        key: privateKeyPEM,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      buffer,
    );
    return decrypted.toString("base64");
  }
}

/**
 * High-level API combining AES and RSA
 */
export class SecureBridge {
  /**
   * Client-side: Encrypt a request payload
   * @param payload - Request payload to encrypt
   * @param serverPublicKey - Server's RSA public key in PEM format
   * @returns Encrypted payload ready to send to server
   */
  static encryptRequest(
    payload: string,
    serverPublicKey: string,
  ): EncryptedPayload {
    // Step 1: Encrypt payload with AES-256-GCM
    const aesResult = AES256GCM.encrypt(payload);

    // Step 2: Encrypt AES key with server's RSA public key
    const encryptedAESKey = RSAKeyPairManager.encryptWithPublicKey(
      aesResult.key,
      serverPublicKey,
    );

    return {
      ciphertext: aesResult.ciphertext,
      encryptedAESKey,
      iv: aesResult.iv,
      authTag: aesResult.authTag,
    };
  }

  /**
   * Server-side: Decrypt a request payload
   * @param encryptedPayload - Encrypted payload from client
   * @param serverPrivateKey - Server's RSA private key in PEM format
   * @returns Decrypted plaintext payload
   */
  static decryptRequest(
    encryptedPayload: EncryptedPayload,
    serverPrivateKey: string,
  ): string {
    // Step 1: Decrypt AES key using server's private key
    const aesKey = RSAKeyPairManager.decryptWithPrivateKey(
      encryptedPayload.encryptedAESKey,
      serverPrivateKey,
    );

    // Step 2: Decrypt payload using AES-256-GCM
    const plaintext = AES256GCM.decrypt({
      ciphertext: encryptedPayload.ciphertext,
      iv: encryptedPayload.iv,
      authTag: encryptedPayload.authTag,
      key: aesKey,
    });

    return plaintext;
  }
}

// Export all for convenience
export default {
  AES256GCM,
  RSAKeyPairManager,
  SecureBridge,
};
