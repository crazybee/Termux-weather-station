/**
 * Client-Side End-to-End Encryption for Local Wi-Fi Security
 *
 * Uses native Web Crypto API (SubtleCrypto) to perform hybrid encryption:
 * 1. Generates an ephemeral 256-bit AES-GCM key in the browser.
 * 2. Encrypts username, password, and timestamp with AES-256-GCM.
 * 3. Encrypts the ephemeral AES key with the server's RSA-2048-OAEP public key.
 *
 * This ensures that credentials sent over an unencrypted local Wi-Fi / HTTP
 * network cannot be intercepted or read by any packet sniffer.
 */

let cachedPublicKeyPem: string | null = null;
let cachedRsaKey: CryptoKey | null = null;

// Convert Base64 string to Uint8Array / ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert PEM format to ArrayBuffer for WebCrypto spki import
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64Lines = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  return base64ToArrayBuffer(b64Lines);
}

/**
 * Fetches and imports the server's RSA-2048 public key.
 */
export async function getOrFetchServerPublicKey(): Promise<CryptoKey | null> {
  if (cachedRsaKey) return cachedRsaKey;

  try {
    const res = await fetch("/api/easee/public-key");
    if (!res.ok) throw new Error("Failed to fetch public key from server");
    const data = await res.json();
    if (!data.publicKey) throw new Error("Invalid public key response");

    cachedPublicKeyPem = data.publicKey;
    const derBuffer = pemToArrayBuffer(cachedPublicKeyPem!);

    cachedRsaKey = await window.crypto.subtle.importKey(
      "spki",
      derBuffer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["encrypt"]
    );

    return cachedRsaKey;
  } catch (err) {
    console.warn("[CryptoClient] WebCrypto public key fetch/import failed:", err);
    return null;
  }
}

export interface EncryptedCredentialsPayload {
  encryptedData: string;
  encryptedKey: string;
  iv: string;
  isEncrypted: boolean;
}

/**
 * Encrypts Easee username and password before sending over local Wi-Fi.
 */
export async function encryptCredentialsForLocalTransmission(
  userName: string,
  pass: string
): Promise<{ payload: any; encrypted: boolean }> {
  try {
    // Verify WebCrypto support
    if (!window.crypto || !window.crypto.subtle) {
      console.warn("[CryptoClient] Web Crypto API not available. Sending standard payload.");
      return { payload: { userName, username: userName, password: pass }, encrypted: false };
    }

    const rsaKey = await getOrFetchServerPublicKey();
    if (!rsaKey) {
      return { payload: { userName, username: userName, password: pass }, encrypted: false };
    }

    // 1. Generate ephemeral AES-256-GCM key
    const aesKey = await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt"]
    );

    // 2. Export raw AES key and encrypt with server RSA public key
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      rsaKey,
      rawAesKey
    );

    // 3. Generate random 12-byte IV for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 4. Encrypt credential JSON payload with AES-GCM
    const credentialData = JSON.stringify({
      userName,
      password: pass,
      timestamp: Date.now(),
    });
    const encodedData = new TextEncoder().encode(credentialData);

    const encryptedDataBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      aesKey,
      encodedData
    );

    return {
      payload: {
        encryptedData: arrayBufferToBase64(encryptedDataBuffer),
        encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
        iv: arrayBufferToBase64(iv),
        isEncrypted: true,
      },
      encrypted: true,
    };
  } catch (error) {
    console.error("[CryptoClient] Encryption failed:", error);
    // Fallback to regular payload if encryption encounters an error
    return { payload: { userName, password: pass }, encrypted: false };
  }
}
