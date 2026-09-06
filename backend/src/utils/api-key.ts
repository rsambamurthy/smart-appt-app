import crypto from 'crypto';

// Integration API keys (see prisma schema's IntegrationApiKey and
// middleware/auth.ts). A key's plaintext secret is generated once, shown to
// the Manager exactly once, and never stored — only its SHA-256 hash is kept,
// so a database dump alone can never be used to authenticate as a key.

const KEY_PREFIX = 'bpm_live_';

/** A fresh plaintext secret, e.g. "bpm_live_9f3a...48 hex chars...". */
export function generateApiKeySecret(): string {
  return `${KEY_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

/** The short, non-secret prefix stored alongside the hash so the admin screen
 * can show which key is which without ever displaying the full secret again. */
export function apiKeyPrefix(secret: string): string {
  return secret.slice(0, 16);
}

/** SHA-256 hex digest — deterministic, so a lookup can hash an incoming
 * header and match it against the stored `key_hash` with a single indexed
 * equality check (no need to load and compare every row, unlike a salted
 * password hash — a leaked API key is already fully compromised on its own,
 * so unlike a password there is no separate secret worth protecting per row). */
export function hashApiKeySecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}
