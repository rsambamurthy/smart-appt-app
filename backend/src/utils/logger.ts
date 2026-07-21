import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const SENSITIVE_FIELDS = ['otp', 'token', 'password', 'token_hash', 'account_no', 'key_secret'];

const redactSensitive = winston.format((info) => {
  const sanitize = (obj: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.some((f) => k.toLowerCase().includes(f))) {
        out[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = sanitize(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out;
  };
  return sanitize(info as unknown as Record<string, unknown>) as typeof info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: combine(
    redactSensitive(),
    timestamp(),
    json(),
  ),
  transports: [new winston.transports.Console()],
});

if (process.env.NODE_ENV === 'development') {
  logger.clear();
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    }),
  );
}

export default logger;
