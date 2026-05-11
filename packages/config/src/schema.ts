import { z } from 'zod'

// Snowflake regex for Discord IDs: 17-20 digit string
const SNOWFLAKE = /^\d{17,20}$/

// Truthy strings: "true" or "1"
const isTruthy = (s: string): boolean => s === 'true' || s === '1'

// Base64 32-byte validator for AES-256 keys
const isBase64Of32Bytes = (s: string): boolean => {
  try {
    return Buffer.from(s, 'base64').length === 32
  } catch {
    return false
  }
}

// DATABASE_URL prefix validator
const isValidDbUrl = (s: string): boolean =>
  s.startsWith('sqlite://') ||
  s.startsWith('file:') ||
  s.startsWith('postgres://') ||
  s.startsWith('postgresql://')

// TOTAL_SHARDS validator: "auto" or numeric string
const isAutoOrNumeric = (s: string): boolean => s === 'auto' || /^\d+$/.test(s)

/**
 * Environment variable schema.
 *
 * REQUIRED vars are typed as `z.string()` with validation (no default).
 * OPTIONAL vars have `.default('...')` and may be transformed/coerced.
 *
 * Booleans are coerced via `.transform()` from truthy string ("true" | "1").
 * Numbers are coerced via `.transform()` + `.pipe(z.number())`.
 *
 * The schema strips unknown keys (default zod behavior), so passing
 * `process.env` directly is safe.
 */
export const EnvSchema = z.object({
  // --- REQUIRED ---
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN must not be empty'),

  DISCORD_CLIENT_ID: z
    .string()
    .regex(SNOWFLAKE, 'DISCORD_CLIENT_ID must be a valid Discord snowflake (17-20 digits)'),

  MASTER_ENC_KEY: z
    .string()
    .refine(isBase64Of32Bytes, 'MASTER_ENC_KEY must be a base64-encoded 32-byte key'),

  // --- OPTIONAL with defaults ---
  MASTER_ENC_KEY_VERSION: z
    .string()
    .default('1')
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().positive('MASTER_ENC_KEY_VERSION must be a positive integer')),

  DATABASE_URL: z
    .string()
    .default('sqlite://./data/bot.db')
    .refine(
      isValidDbUrl,
      'DATABASE_URL must start with sqlite://, file:, postgres://, or postgresql://',
    ),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),

  TOTAL_SHARDS: z
    .string()
    .default('auto')
    .refine(isAutoOrNumeric, 'TOTAL_SHARDS must be "auto" or a numeric string'),

  CLUSTER_COUNT: z
    .string()
    .default('1')
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().positive('CLUSTER_COUNT must be a positive integer')),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

  IDLE_TEXT_INACTIVITY_MS: z
    .string()
    .default('300000')
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().positive('IDLE_TEXT_INACTIVITY_MS must be a positive integer')),

  IDLE_LEAVE_ON_EMPTY: z
    .string()
    .default('true')
    .transform(isTruthy),

  PLAYGROUND_PORT: z
    .string()
    .default('5173')
    .transform((s) => parseInt(s, 10))
    .pipe(
      z.number().int().min(1, 'PLAYGROUND_PORT must be >= 1').max(65535, 'PLAYGROUND_PORT must be <= 65535'),
    ),

  DOCS_PORT: z
    .string()
    .default('4000')
    .transform((s) => parseInt(s, 10))
    .pipe(
      z.number().int().min(1, 'DOCS_PORT must be >= 1').max(65535, 'DOCS_PORT must be <= 65535'),
    ),

  PLAYGROUND_MOCK_OPENROUTER: z
    .string()
    .default('false')
    .transform(isTruthy),

  PLAYGROUND_WRITE_ENABLED: z
    .string()
    .default('false')
    .transform(isTruthy),

  PLAYGROUND_ALLOW_ALL: z
    .string()
    .default('false')
    .transform(isTruthy),
})

/**
 * The fully-validated, parsed config object.
 * Use this type wherever you need the result of `loadConfig()`.
 */
export type Config = z.infer<typeof EnvSchema>
