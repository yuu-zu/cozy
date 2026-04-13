import { JSEncrypt } from "jsencrypt";

const PRIVATE_KEY_STORAGE_PREFIX = "cozy:private-key:";

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const crypt = new JSEncrypt({ default_key_size: "2048" });
  crypt.getKey();

  const publicKey = crypt.getPublicKey();
  const privateKey = crypt.getPrivateKey();

  if (!publicKey || !privateKey) {
    throw new Error("Khong the sinh cap khoa RSA.");
  }

  return { publicKey, privateKey };
}

export async function encryptMessage(message: string, publicKey: string): Promise<string> {
  const encoder = new TextEncoder();

  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = encoder.encode(message);
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedMessage
  );

  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const aesKeyBase64 = bufferToBase64(rawAesKey);

  const rsa = new JSEncrypt();
  rsa.setPublicKey(publicKey);
  const encryptedAesKey = rsa.encrypt(aesKeyBase64);

  if (!encryptedAesKey) {
    throw new Error("Khong the ma hoa khoa AES bang RSA.");
  }

  return JSON.stringify({
    encryptedAesKey,
    iv: uint8ArrayToBase64(iv),
    data: bufferToBase64(encryptedData),
  });
}

export async function decryptMessage(encryptedPayload: string, privateKey: string): Promise<string> {
  const payload = JSON.parse(encryptedPayload) as {
    encryptedAesKey: string;
    iv: string;
    data: string;
  };

  const rsa = new JSEncrypt();
  rsa.setPrivateKey(privateKey);
  const aesKeyBase64 = rsa.decrypt(payload.encryptedAesKey);

  if (!aesKeyBase64) {
    throw new Error("Khong the giai ma khoa AES bang private key.");
  }

  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(aesKeyBase64),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptedData = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8Array(payload.iv) },
    aesKey,
    base64ToArrayBuffer(payload.data)
  );

  return new TextDecoder().decode(decryptedData);
}

export function savePrivateKeyToLocalStorage(uid: string, privateKey: string) {
  localStorage.setItem(`${PRIVATE_KEY_STORAGE_PREFIX}${uid}`, privateKey);
}

export function getPrivateKeyFromLocalStorage(uid: string) {
  return localStorage.getItem(`${PRIVATE_KEY_STORAGE_PREFIX}${uid}`);
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
