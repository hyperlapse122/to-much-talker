// Abstract IPC transport interface.
// Concrete implementations are provided by consumers:
// - apps/server: HybridShardingIpcTransport (Task 17)
// - apps/playground: NoopIpcTransport (read-only)

export interface IpcTransport {
  broadcastInvalidate(guildId: string): Promise<void>
  onInvalidate(handler: (guildId: string) => void): void
}

export class NoopIpcTransport implements IpcTransport {
  async broadcastInvalidate(guildId: string): Promise<void> {
    void guildId
    return Promise.resolve()
  }

  onInvalidate(handler: (guildId: string) => void): void {
    void handler
  }
}
