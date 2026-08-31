import crypto from 'node:crypto';
import { config } from '../config.js';

// Cifra los access tokens de Facebook antes de guardarlos en la base de datos
// (AES-256-GCM). Nunca se guardan tokens en texto plano.
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = config.tokenEncryptionKey;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY debe ser una cadena hex de 64 caracteres (32 bytes). ' +
        'Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptToken(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // formato almacenado: iv:authTag:ciphertext (todo en hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(stored: string): string {
  const [ivHex, authTagHex, dataHex] = stored.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Formato de token cifrado inválido.');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
