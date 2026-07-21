import crypto from 'crypto';

/** Generate a cryptographically secure random token */
export const generateToken = (bytes = 32): string =>
  crypto.randomBytes(bytes).toString('hex');

/** SHA-256 hash a token for safe storage */
export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Generate a numeric OTP of given length */
export const generateOtp = (length = 6): string => {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  return String(crypto.randomInt(min, max));
};

/** Normalise phone to E.164 format (India default) */
export const normalisePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};

/** AES-256-CBC encrypt a plaintext string */
export const encrypt = (text: string): string => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(process.env.ENCRYPTION_IV!, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
};

/** AES-256-CBC decrypt a ciphertext string */
export const decrypt = (ciphertext: string): string => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(process.env.ENCRYPTION_IV!, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
};

/** Strip HTML tags from a string */
export const stripHtml = (str: string): string =>
  str.replace(/<[^>]*>/g, '').trim();

/** Parse cursor-based pagination query params */
export const parsePagination = (query: { cursor?: string; limit?: string }) => ({
  cursor: query.cursor,
  limit: Math.min(parseInt(query.limit ?? '20', 10), 100),
});

/** Build a cursor-paginated response */
export const paginatedResponse = <T extends { id: string }>(
  items: T[],
  limit: number,
) => ({
  data: items,
  meta: {
    next_cursor: items.length === limit ? items[items.length - 1].id : null,
    count: items.length,
  },
});

/** Compute SLA due date based on priority */
export const computeSlaDueAt = (priority: string, assignedAt: Date): Date => {
  const hoursMap: Record<string, number> = {
    EMERGENCY: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168,
  };
  const hours = hoursMap[priority] ?? 72;
  return new Date(assignedAt.getTime() + hours * 60 * 60 * 1000);
};
