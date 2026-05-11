import type { Result } from '@to-much-talker/shared'
import { ConfigError } from '@to-much-talker/shared'
import { EnvSchema } from './schema.js'
import type { Config } from './schema.js'

/**
 * Validate the given env object against the config schema.
 *
 * Returns `Result.ok(config)` on success or `Result.err(ConfigError)` with a
 * human-readable message listing every failing field.
 *
 * This function is pure: it does NOT read `process.env` itself, does NOT
 * touch the filesystem, and does NOT throw. The caller is responsible for
 * passing the env object (defaults to `process.env` for convenience).
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Result<Config, ConfigError> {
  const result = EnvSchema.safeParse(env)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    return { ok: false, error: new ConfigError(`Invalid env: ${issues}`) }
  }
  return { ok: true, value: result.data }
}

/**
 * Load config or exit the process with code 1 on failure.
 *
 * Intended for CLI / bot entrypoints only. All other packages should call
 * `loadConfig` and propagate the `Result` instead of exiting.
 *
 * Writes the error and a remediation hint to stderr before exiting. We use
 * `process.stderr.write` directly because pino is not yet initialized when
 * config is loaded at startup.
 */
export function loadConfigOrExit(env: Record<string, string | undefined> = process.env): Config {
  const result = loadConfig(env)
  if (!result.ok) {
    process.stderr.write(`[config] Fatal: ${result.error.message}\n`)
    process.stderr.write('[config] Remediation: check .env.example for required variables\n')
    process.exit(1)
  }
  return result.value
}
