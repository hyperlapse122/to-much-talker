import { Command } from 'commander'
import { generateMasterKey } from '@to-much-talker/crypto'

export type CliCommand = 'start' | 'key-gen' | 'key-rotate' | 'migrate'

export interface CliOptions {
  readonly command: CliCommand
  readonly newKey?: string
}

/**
 * Parse argv and return the resolved command + options.
 *
 * Side effect: the `key gen` action prints the generated key and exits
 * (matches expected CLI UX — single-output commands terminate immediately).
 *
 * We let commander parse for help/version/error UX, but we also derive the
 * resolved `CliOptions` ourselves from argv so the caller can dispatch via
 * a single discriminated union instead of fighting commander's action API.
 */
export function parseCli(argv: string[]): CliOptions {
  const program = new Command()
    .name('tmt-bot')
    .description('To Much Talker — Discord TTS bot')
    .version('0.0.1')

  // Default command: start
  program
    .command('start', { isDefault: true })
    .description('Start the bot (auto-detects cluster manager vs worker role)')
    .action(() => {
      // Dispatched by index.ts main()
    })

  // Key management
  const key = program.command('key').description('Master key management')

  key
    .command('gen')
    .description('Generate a new AES-256-GCM master key (base64)')
    .action(() => {
      process.stdout.write(generateMasterKey() + '\n')
      process.exit(0)
    })

  key
    .command('rotate')
    .description('Rotate master key (re-encrypts all stored keys in DB)')
    .requiredOption('--new-key <base64>', 'New master key (base64, 32 bytes)')
    .option('--dry-run', 'Log what would be changed without writing', false)
    .action(async (opts: { newKey: string; dryRun: boolean }) => {
      try {
        const { loadConfigOrExit } = await import('@to-much-talker/config')
        const { keyRotate } = await import('./cli/keyRotate.js')
        const config = loadConfigOrExit()
        await keyRotate({
          newKeyBase64: opts.newKey,
          dryRun: opts.dryRun,
          config,
        })
        process.exit(0)
      } catch (cause) {
        process.stderr.write(`Key rotation failed: ${String(cause)}\n`)
        process.exit(1)
      }
    })

  // Migrate
  program
    .command('migrate')
    .description('Run database migrations only (no bot start)')
    .action(() => {
      // Dispatched by index.ts main()
    })

  program.parse(argv)

  // Derive resolved command from positional args. commander's action handlers
  // run sync for `key gen` and `key rotate` (which both `process.exit`).
  const [, , cmd, sub] = argv

  if (cmd === 'key' && sub === 'gen') return { command: 'key-gen' }
  if (cmd === 'key' && sub === 'rotate') {
    const idx = argv.indexOf('--new-key')
    const newKey = idx >= 0 ? argv[idx + 1] : undefined
    return newKey === undefined
      ? { command: 'key-rotate' }
      : { command: 'key-rotate', newKey }
  }
  if (cmd === 'migrate') return { command: 'migrate' }
  return { command: 'start' }
}
