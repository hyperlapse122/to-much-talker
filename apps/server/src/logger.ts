import pino from 'pino'
import type { LoggerOptions } from 'pino'

const isDev = process.env['NODE_ENV'] !== 'production'

const baseOptions: LoggerOptions = {
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: [
      'apiKey',
      'token',
      'authorization',
      'DISCORD_TOKEN',
      'MASTER_ENC_KEY',
      'OPENROUTER_API_KEY',
      '*.apiKey',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
}

export const logger = pino(
  isDev
    ? {
        ...baseOptions,
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }
    : baseOptions,
)

export type Logger = typeof logger
