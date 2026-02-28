// lib/logger.ts
// Production-ready logger that suppresses debug output in production

const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  /** Debug-level: suppressed in production */
  debug: (...args: unknown[]) => {
    if (!isProduction) console.log(...args);
  },

  /** Info-level: always logged */
  info: (...args: unknown[]) => {
    console.log('[INFO]', ...args);
  },

  /** Warning-level: always logged */
  warn: (...args: unknown[]) => {
    console.warn('[WARN]', ...args);
  },

  /** Error-level: always logged */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },
};
