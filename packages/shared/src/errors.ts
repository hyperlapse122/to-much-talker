export class AppError extends Error {
  readonly code: string
  readonly context: Record<string, unknown>
  override readonly cause: unknown

  constructor(
    message: string,
    options: { code: string; cause?: unknown; context?: Record<string, unknown> },
  ) {
    super(message, { cause: options.cause })
    this.code = options.code
    this.context = options.context ?? {}
    this.cause = options.cause
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'VALIDATION_ERROR', cause })
  }
}

export class PermissionError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'PERMISSION_ERROR', cause })
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'RATE_LIMIT_ERROR', cause })
  }
}

export class UpstreamError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'UPSTREAM_ERROR', cause })
  }
}

export class ConfigError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'CONFIG_ERROR', cause })
  }
}

export class EncryptionError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'ENCRYPTION_ERROR', cause })
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'NOT_FOUND_ERROR', cause })
  }
}

export class DbError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'DB_ERROR', cause })
  }
}
