import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  Events,
  MessageFlags,
  type ModalSubmitInteraction,
} from 'discord.js'
import { logger } from '../logger.js'

const log = logger.child({ component: 'router' })

/**
 * Handler signature for a single slash command (or subcommand).
 */
export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>
export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>
export type ModalHandler = (interaction: ModalSubmitInteraction) => Promise<void>

/** Map key: `${commandName}` or `${commandName}.${subcommand}`. */
type HandlerKey = string

/**
 * Dispatches `interactionCreate` events to registered command handlers.
 *
 * Slash commands are keyed by either `commandName` (no subcommand) or
 * `commandName.subcommand` (when a subcommand is present). Per Task 13 spec,
 * every interaction MUST receive a reply or editReply — handler errors are
 * caught here so a thrown handler never times out the interaction.
 */
export class InteractionRouter {
  readonly #handlers = new Map<HandlerKey, CommandHandler>()
  readonly #buttonHandlers = new Map<string, ButtonHandler>()
  readonly #modalHandlers = new Map<string, ModalHandler>()

  /**
   * Register a handler. Pass `null` for `subcommand` to handle the
   * top-level command (commands without subcommands).
   */
  register(commandName: string, subcommand: string | null, handler: CommandHandler): void {
    const key = subcommand !== null ? `${commandName}.${subcommand}` : commandName
    this.#handlers.set(key, handler)
  }

  registerButton(customId: string, handler: ButtonHandler): void {
    this.#buttonHandlers.set(customId, handler)
  }

  registerModal(customId: string, handler: ModalHandler): void {
    this.#modalHandlers.set(customId, handler)
  }

  async dispatch(interaction: ChatInputCommandInteraction): Promise<void> {
    const startedAtMs = performance.now()
    const subcommand = interaction.options.getSubcommand(false)
    const key =
      subcommand !== null ? `${interaction.commandName}.${subcommand}` : interaction.commandName

    log.debug(
      {
        key,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        interactionId: interaction.id,
      },
      'Command interaction received',
    )

    const handler = this.#handlers.get(key)
    if (handler === undefined) {
      log.warn(
        { key, guildId: interaction.guildId, channelId: interaction.channelId },
        'No handler registered for command',
      )
      await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral })
      return
    }

    try {
      await handler(interaction)
      log.debug(
        {
          key,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          durationMs: Math.round(performance.now() - startedAtMs),
        },
        'Command interaction handled',
      )
    } catch (error) {
      log.error(
        {
          key,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          durationMs: Math.round(performance.now() - startedAtMs),
          error: error instanceof Error ? error.message : String(error),
        },
        'Command handler error',
      )

      const errorMessage = 'An error occurred while executing this command.'
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: errorMessage })
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral })
        }
      } catch {
        // Reply already sent or interaction expired — nothing we can do.
      }
    }
  }

  async dispatchButton(interaction: ButtonInteraction): Promise<void> {
    const handler = this.#buttonHandlers.get(interaction.customId)
    if (handler === undefined) {
      log.warn({ customId: interaction.customId }, 'No handler registered for button')
      await interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral })
      return
    }

    try {
      await handler(interaction)
    } catch (error) {
      log.error(
        {
          customId: interaction.customId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Button handler error',
      )

      const errorMessage = 'An error occurred while executing this action.'
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: errorMessage, components: [] })
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral })
        }
      } catch {
        // Reply already sent or interaction expired — nothing we can do.
      }
    }
  }

  async dispatchModal(interaction: ModalSubmitInteraction): Promise<void> {
    const handler = this.#modalHandlers.get(interaction.customId)
    if (handler === undefined) {
      log.warn({ customId: interaction.customId }, 'No handler registered for modal')
      await interaction.reply({ content: 'Unknown action.', flags: MessageFlags.Ephemeral })
      return
    }

    try {
      await handler(interaction)
    } catch (error) {
      log.error(
        {
          customId: interaction.customId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Modal handler error',
      )

      const errorMessage = 'An error occurred while executing this action.'
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: errorMessage, components: [] })
        } else {
          await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral })
        }
      } catch {
        // Reply already sent or interaction expired — nothing we can do.
      }
    }
  }

  /**
   * Attach a single `interactionCreate` listener to the given client that
   * forwards chat-input commands to {@link dispatch}.
   */
  attachTo(client: Client): void {
    client.on(Events.InteractionCreate, (interaction) => {
      if (interaction.isChatInputCommand()) {
        void this.dispatch(interaction)
        return
      }

      if (interaction.isButton()) {
        void this.dispatchButton(interaction)
        return
      }

      if (interaction.isModalSubmit()) {
        void this.dispatchModal(interaction)
      }
    })
  }
}
