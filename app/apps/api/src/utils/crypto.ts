import crypto from "node:crypto";
import { env } from "../config/env";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  if (!env.UNIT_SECRET_ENCRYPTION_KEY) {
    throw new Error(
      "UNIT_SECRET_ENCRYPTION_KEY no esta configurado. Genera uno con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const key = Buffer.from(env.UNIT_SECRET_ENCRYPTION_KEY, "hex");
  if (key.length !== 32) {
    throw new Error("UNIT_SECRET_ENCRYPTION_KEY debe ser un hex de 32 bytes (64 caracteres).");
  }
  return key;
}

/**
 * AES-256-GCM encrypt. Returns "iv:authTag:ciphertext" all hex-encoded.
 * Never log the plaintext input or the returned string in a readable form.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Formato de secreto cifrado invalido.");
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}
