// Resolution policies for each setting key.
// 'clamp-max': lower scopes cannot exceed the server ceiling.
// 'override-if-in-list': lower scopes can override only with a server-allowed value.
// 'server-only': only the authoritative configured scope applies.
// 'user-wins': lower user preference overrides higher defaults when present.

export type ResolutionPolicy =
  | { readonly kind: 'clamp-max'; readonly serverKey: string }
  | { readonly kind: 'override-if-in-list'; readonly allowedKey: string }
  | { readonly kind: 'server-only' }
  | { readonly kind: 'user-wins' }

export interface KeyPolicy {
  readonly server: string | null
  readonly channel: string | null
  readonly user: string | null
  readonly policy: ResolutionPolicy
  readonly defaultValue: unknown
}

export const POLICY_TABLE: Record<string, KeyPolicy> = {
  max_chars: {
    server: 'maxChars',
    channel: 'maxChars',
    user: null,
    policy: { kind: 'clamp-max', serverKey: 'maxChars' },
    defaultValue: 500,
  },
  max_price_cents: {
    server: 'maxPriceCents',
    channel: null,
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: null,
  },
  default_model: {
    server: 'defaultModel',
    channel: null,
    user: 'preferredModel',
    policy: { kind: 'override-if-in-list', allowedKey: 'allowedModels' },
    defaultValue: 'google/gemini-3.1-flash-tts-preview',
  },
  default_voice: {
    server: 'defaultVoice',
    channel: null,
    user: 'preferredVoice',
    policy: { kind: 'user-wins' },
    defaultValue: null,
  },
  queue_strategy: {
    server: null,
    channel: 'queueStrategy',
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: 'drop-oldest',
  },
  max_queue_size: {
    server: null,
    channel: 'maxQueueSize',
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: 20,
  },
  locale: {
    server: 'locale',
    channel: null,
    user: 'preferredLocale',
    policy: { kind: 'user-wins' },
    defaultValue: 'en',
  },
  idle_text_inactivity_ms: {
    server: 'idleTextInactivityMs',
    channel: null,
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: 300000,
  },
  idle_leave_on_empty: {
    server: 'idleLeaveOnEmpty',
    channel: null,
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: true,
  },
  allowed_models: {
    server: 'allowedModels',
    channel: null,
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: ['google/gemini-3.1-flash-tts-preview', 'openai/gpt-4o-mini-tts-2025-12-15'],
  },
  permissions_role_id: {
    server: 'permissionsRoleId',
    channel: null,
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: null,
  },
  bound_text_channel_id: {
    server: null,
    channel: 'boundTextChannelId',
    user: null,
    policy: { kind: 'server-only' },
    defaultValue: null,
  },
}
