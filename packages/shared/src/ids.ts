import { z } from 'zod'

// Branded ID types
export type GuildId = string & { readonly __brand: 'GuildId' }
export type ChannelId = string & { readonly __brand: 'ChannelId' }
export type UserId = string & { readonly __brand: 'UserId' }
export type MessageId = string & { readonly __brand: 'MessageId' }
export type ShardId = number & { readonly __brand: 'ShardId' }
export type ClusterId = number & { readonly __brand: 'ClusterId' }

// Snowflake regex: 17-20 digit string
const SNOWFLAKE = /^\d{17,20}$/

export function asGuildId(s: string): GuildId {
  if (!SNOWFLAKE.test(s)) throw new Error(`Invalid GuildId: ${s}`)
  return s as GuildId
}

export function asChannelId(s: string): ChannelId {
  if (!SNOWFLAKE.test(s)) throw new Error(`Invalid ChannelId: ${s}`)
  return s as ChannelId
}

export function asUserId(s: string): UserId {
  if (!SNOWFLAKE.test(s)) throw new Error(`Invalid UserId: ${s}`)
  return s as UserId
}

export function asMessageId(s: string): MessageId {
  if (!SNOWFLAKE.test(s)) throw new Error(`Invalid MessageId: ${s}`)
  return s as MessageId
}

export function asShardId(n: number): ShardId {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid ShardId: ${n}`)
  return n as ShardId
}

export function asClusterId(n: number): ClusterId {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid ClusterId: ${n}`)
  return n as ClusterId
}

// Zod schemas
export const GuildIdSchema = z.string().regex(SNOWFLAKE).transform((s) => s as GuildId)
export const ChannelIdSchema = z.string().regex(SNOWFLAKE).transform((s) => s as ChannelId)
export const UserIdSchema = z.string().regex(SNOWFLAKE).transform((s) => s as UserId)
export const MessageIdSchema = z.string().regex(SNOWFLAKE).transform((s) => s as MessageId)
