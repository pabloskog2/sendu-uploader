/**
 * Cifrado simétrico (AES-256-GCM) para credenciales sensibles guardadas en
 * la base de datos: la Clave Tributaria del SII y el token de Duemint.
 *
 * Por qué esto importa especialmente para la Clave Tributaria: es la
 * contraseña completa del portal tributario de la empresa, no una API key
 * de solo lectura — si la base de datos se filtra en texto plano, quien la
 * lea puede entrar a sii.cl como esa empresa (declarar, ceder facturas,
 * ver toda su situación tributaria), sin importar que nuestra propia app
 * solo la use para hacer GET.
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "Falta APP_ENCRYPTION_KEY en el entorno (necesaria para guardar credenciales cifradas)"
    );
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY debe ser una clave de 32 bytes codificada en base64");
  }
  return key;
}

/** Cifra un secreto para guardarlo en la base de datos. */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Descifra un secreto guardado con encryptSecret(). */
export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
