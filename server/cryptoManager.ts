import crypto from "crypto";

interface DecryptedCredentials {
  userName: string;
  password: string;
  timestamp?: number;
}

// Generate an RSA-2048 keypair on server initialization in memory
// Private key never leaves the server memory.
let keyPair: { publicKey: string; privateKey: string };

try {
  keyPair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  console.log("[Crypto] Server RSA-2048 keypair generated for local Wi-Fi payload encryption.");
} catch (err) {
  console.error("[Crypto] Failed to generate RSA keypair:", err);
  keyPair = { publicKey: "", privateKey: "" };
}

/**
 * Returns the server's public key (PEM format) for clients to encrypt credentials.
 */
export function getPublicKeyPem(): string {
  return keyPair.publicKey;
}

/**
 * Decrypts hybrid RSA-OAEP + AES-256-GCM payload sent from frontend.
 *
 * Payload format:
 * {
 *   encryptedData: base64(AES-GCM ciphertext + 16-byte auth tag),
 *   encryptedKey: base64(RSA-OAEP encrypted AES key),
 *   iv: base64(12-byte initialization vector)
 * }
 */
export function decryptCredentialsPayload(
  encryptedDataB64: string,
  encryptedKeyB64: string,
  ivB64: string
): { success: boolean; data?: DecryptedCredentials; error?: string } {
  try {
    if (!keyPair.privateKey) {
      return { success: false, error: "Server encryption key unavailable." };
    }

    // 1. Decrypt the ephemeral AES key using server's RSA private key (RSA-OAEP with SHA-256)
    const encryptedKeyBuffer = Buffer.from(encryptedKeyB64, "base64");
    const rawAesKey = crypto.privateDecrypt(
      {
        key: keyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encryptedKeyBuffer
    );

    // 2. Extract IV, ciphertext and auth tag (last 16 bytes)
    const iv = Buffer.from(ivB64, "base64");
    const encryptedDataBuffer = Buffer.from(encryptedDataB64, "base64");

    if (encryptedDataBuffer.length < 16) {
      return { success: false, error: "Encrypted payload too short." };
    }

    const authTag = encryptedDataBuffer.subarray(encryptedDataBuffer.length - 16);
    const ciphertext = encryptedDataBuffer.subarray(0, encryptedDataBuffer.length - 16);

    // 3. Decrypt AES-256-GCM
    const decipher = crypto.createDecipheriv("aes-256-gcm", rawAesKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const jsonString = decryptedBuffer.toString("utf8");
    const parsed: DecryptedCredentials = JSON.parse(jsonString);

    // 4. Validate replay timestamp (within 15 minutes to tolerate mobile clock drift)
    if (parsed.timestamp) {
      const now = Date.now();
      const ageMs = Math.abs(now - parsed.timestamp);
      if (ageMs > 900_000) {
        return { success: false, error: "Encrypted payload timestamp mismatch or expired (check system clock)." };
      }
    }

    if (!parsed.userName || !parsed.password) {
      return { success: false, error: "Decrypted payload missing username or password." };
    }

    return {
      success: true,
      data: parsed,
    };
  } catch (err: any) {
    console.error("[Crypto] Decryption error:", err);
    return {
      success: false,
      error: `Decryption failed: ${err.message || "Corrupted ciphertext"}`,
    };
  }
}
